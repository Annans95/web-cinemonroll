/* ================================
   api.js — Comunicação com o Back-end Node.js
   ================================= */

/*
   O que esse arquivo faz:
  - Envia os dados do pedido (ingresso + lanches + pagamento) do front pro back-end Node.js.
  - Recebe a resposta (ex: "Compra confirmada!" ou erro).
  - Carrega a lista de assentos ocupados do banco de dados.
*/

/*  URL BASE DA API
   Substitua "http://localhost:3000/..."
   pela URL real do seu endpoint Node.js quando souber.
*/
// Endpoint correto para enviar um pedido/venda ao back-end
const API_URL = "https://apisistemaingresso-production.up.railway.app"
const API_Cliente = `${API_URL}/cliente`;
const API_Filme = `${API_URL}/filme`;
const API_Sala = `${API_URL}/sala`;
const API_Sessao = `${API_URL}/sessao`;
const API_Venda = `${API_URL}/venda`;
const API_Ingresso = `${API_URL}/ingresso`;
const API_Lanche = `${API_URL}/lanche`;
const API_VendaLanche = `${API_URL}/venda-lanche`;
const API_Assento = `${API_URL}/assento`;

/*  Função para enviar os dados da compra ao back-end */
async function enviarPedido(dadosCompra) {
  try {
    console.log("📦 Dados recebidos:", dadosCompra);

    // 1️⃣ Validações iniciais
    if (!dadosCompra.nome || !dadosCompra.email) {
      alert("❌ Nome e email são obrigatórios.");
      return null;
    }

    if (!dadosCompra.sessaoId) {
      alert("❌ Selecione uma sessão válida.");
      return null;
    }

    if (!dadosCompra.assentos || dadosCompra.assentos.length === 0) {
      alert("❌ Selecione pelo menos um assento.");
      return null;
    }

    // 2️⃣ Criar cliente
    const clientePayload = {
      cliente: dadosCompra.nome,
      email: dadosCompra.email,
      cpf: dadosCompra.cpf || null
    };

    console.log("👤 Criando cliente:", clientePayload);

    const resCliente = await fetch(API_Cliente, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(clientePayload)
    });

    if (!resCliente.ok) {
      const erro = await resCliente.json();
      console.error("⚠️ Erro ao criar cliente:", erro);
      alert("Erro ao criar cliente. Verifique os dados.");
      return null;
    }

    const clienteCriado = await resCliente.json();
    const cd_cliente = clienteCriado.cd_cliente;
    console.log("✅ Cliente criado:", cd_cliente);

    // 3️⃣ Criar venda
    const vendaPayload = {
      cd_cliente,
      dt_hr_venda: new Date().toISOString(),
      valor_total: dadosCompra.total || 0,
      tp_pagamento: dadosCompra.pagamento || "dinheiro"
    };

    console.log("💳 Criando venda:", vendaPayload);

    const resVenda = await fetch(API_Venda, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vendaPayload)
    });

    if (!resVenda.ok) {
      const erro = await resVenda.json();
      console.error("⚠️ Erro ao criar venda:", erro);
      alert("Erro ao criar venda.");
      return null;
    }

    const vendaCriada = await resVenda.json();
    const nr_recibo = vendaCriada.nr_recibo;
    console.log("✅ Venda criada:", nr_recibo);

    // 4️⃣ Validar sessão
    const sessoesDoFilme = dadosCompra.sessoesDoFilme || [];
    
    if (sessoesDoFilme.length === 0) {
      alert("❌ Nenhuma sessão disponível para este filme e tipo de sessão.");
      return null;
    }

    const sessaoSelecionada = sessoesDoFilme.find(s => s.cd_sessao === dadosCompra.sessaoId);
    
    if (!sessaoSelecionada) {
      alert("❌ Sessão selecionada não encontrada!");
      return null;
    }

    console.log("✅ Sessão validada:", sessaoSelecionada);

    // 5️⃣ Criar ingressos (um para cada assento)
const valorPorAssento = dadosCompra.total / dadosCompra.quantidadeAssentos;

for (let i = 0; i < dadosCompra.assentos.length; i++) {
    const assentoNumero = dadosCompra.assentos[i]; // ex: "A1"
    const tipoIngresso = dadosCompra.tiposIngresso?.[i] || "inteira";

    // 🔹 Se o assento já existir no banco, pega o cd_assento, senão cria um novo assento
    let cd_assento;

    const assentosSessao = await fetch(`${API_Assento}/sessao/${sessaoSelecionada.cd_sessao}`)
        .then(res => res.json())
        .catch(() => []);

    const assentoExistente = assentosSessao.find(a => a.numero_assento === assentoNumero);

    if (assentoExistente) {
        cd_assento = assentoExistente.cd_assento;
    } else {
        // Criar novo assento no banco para esta sessão
        const novoAssentoPayload = {
            numero_assento: assentoNumero,
            cd_sessao: sessaoSelecionada.cd_sessao,
            ocupado: false
        };

        const resNovoAssento = await fetch(API_Assento, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(novoAssentoPayload)
        });

        if (!resNovoAssento.ok) {
            console.error(`❌ Erro ao criar assento ${assentoNumero}`);
            continue; // pula para o próximo assento
        }

        const novoAssentoCriado = await resNovoAssento.json();
        cd_assento = novoAssentoCriado.cd_assento;
    }

    // 🔹 Criar ingresso
    const ingressoPayload = {
        nr_recibo,
        cd_sessao: sessaoSelecionada.cd_sessao,
        cd_assento,
        tp_ingresso: tipoIngresso.slice(0, 10), // garante CHAR(10)
        valor_ingresso: Number(valorPorAssento.toFixed(2))
    };

    console.log(`🎟️ Criando ingresso ${i + 1}:`, ingressoPayload);

    const resIngresso = await fetch(API_Ingresso, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ingressoPayload)
    });

    if (!resIngresso.ok) {
        const erro = await resIngresso.json().catch(() => null);
        console.error("⚠️ Erro ao criar ingresso:", erro);
        continue;
    }
    //Marcar assento como ocupado
        await fetch(`${API_Assento}/${cd_assento}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            numero_assento: assentoNumero, 
            cd_sessao: sessaoSelecionada.cd_sessao,
            ocupado: true 
        })
    });
}

console.log("✅ Ingressos criados");

// 6️⃣ Criar lanches dinamicamente usando cd_lanche
if (dadosCompra.lanches && dadosCompra.lanches !== "Nenhum") {
    console.log("🍿 Processando lanches...");

    const resLanches = await fetch(API_Lanche);
    if (!resLanches.ok) {
        console.warn("⚠️ Não foi possível buscar lanches");
    } else {
        const lanchesDisponiveis = await resLanches.json();
        const lanchesArray = dadosCompra.lanches.split(",").map(l => l.trim());

        for (const lancheStr of lanchesArray) {
            if (!lancheStr) continue; // pula strings vazias

            // Extrai quantidade do formato "Nome (x3)"
            const qtdMatch = lancheStr.match(/\(x(\d+)\)/);
            const quantidade = qtdMatch ? parseInt(qtdMatch[1]) : 1;
            const nomeLanche = lancheStr.replace(/\(x\d+\).*/, "").trim();

            if (!nomeLanche) continue; // pula se o nome ficou vazio

            const lancheInfo = lanchesDisponiveis.find(l =>
                l.nome && l.nome.toLowerCase().trim() === nomeLanche.toLowerCase()
            );

            if (!lancheInfo) {
                console.warn(`⚠️ Lanche não encontrado: ${nomeLanche}`);
                continue;
            }

            const vendaLanchePayload = {
                nr_recibo,
                cd_lanche: lancheInfo.cd_lanche,
                quantidade,
                valor_parcial: quantidade * Number(lancheInfo.valor)
            };

            console.log("🍿 Criando venda-lanche:", vendaLanchePayload);

            await fetch(API_VendaLanche, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(vendaLanchePayload)
            });
        }
    }
}

// 7️⃣ Recalcular total da venda (sempre recalcula, tenha ou não lanches)
console.log("🔄 Recalculando total...");
await fetch(`${API_Venda}/recalcular/${nr_recibo}`, { method: "PUT" });

console.log("✅ Pedido finalizado com sucesso!", { nr_recibo });
return { venda: vendaCriada, nr_recibo };

} catch (erro) {
    console.error("❌ Falha ao conectar com o servidor:", erro);
    alert("Erro de conexão com o servidor. Verifique se o back-end está rodando.");
    return null;
}
} 