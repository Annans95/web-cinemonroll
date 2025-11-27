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
    // 1️⃣ Criar cliente
    const clientePayload = {
      cliente: dadosCompra.nome,
      email: dadosCompra.email || null,
      cpf: dadosCompra.cpf || null
    };

    const resCliente = await fetch(API_Cliente, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(clientePayload)
    });
    const clienteCriado = await resCliente.json();
    if (!resCliente.ok) {
      console.error("⚠️ Erro ao criar cliente:", clienteCriado);
      alert("Erro ao criar cliente.");
      return null;
    }
    const cd_cliente = clienteCriado.cd_cliente;

    // 2️⃣ Criar venda
    const vendaPayload = {
      cd_cliente,
      dt_hr_venda: new Date(),
      valor_total: dadosCompra.total,
      tp_pagamento: dadosCompra.pagamento
    };
    const resVenda = await fetch(API_Venda, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vendaPayload)
    });
    const vendaCriada = await resVenda.json();
    if (!resVenda.ok) {
      console.error("⚠️ Erro ao criar venda:", vendaCriada);
      alert("Erro ao criar venda.");
      return null;
    }
    const nr_recibo = vendaCriada.nr_recibo;

    // 3️⃣ Usar sessões já filtradas que vêm do front-end
    const sessoesDoFilme = dadosCompra.sessoesDoFilme || [];
    
    if (sessoesDoFilme.length === 0) {
      alert("❌ Nenhuma sessão disponível para este filme e tipo de sessão.");
      return null;
    }

    // Validar se a sessão escolhida existe nas sessões filtradas
    const sessaoSelecionada = sessoesDoFilme.find(s => s.cd_sessao === dadosCompra.sessaoId);
    
    if (!sessaoSelecionada) {
      alert("❌ Sessão selecionada não encontrada!");
      return null;
    }

    console.log("✅ Sessão validada:", sessaoSelecionada);

    // 4️⃣ Criar ingressos
    for (const assento of dadosCompra.assentos) {
      const ingressoPayload = {
        nr_recibo,
        cd_sessao: dadosCompra.sessaoId,
        assento,
        tp_ingresso: dadosCompra.tp_ingresso,
        valor_ingresso: dadosCompra.total / dadosCompra.quantidadeAssentos
      };

      await fetch(API_Ingresso, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(ingressoPayload)
      });
    }

    // 5️⃣ Criar lanches dinamicamente
    if (dadosCompra.lanches && dadosCompra.lanches !== "Nenhum") {
      // 4.1 Buscar lanches do back-end
      const resLanches = await fetch(API_Lanche);
      const lanchesDisponiveis = await resLanches.json(); // array de { cd_lanche, nome, valor }

      // 4.2 Mapear lanches do pedido
      const lanchesArray = dadosCompra.lanches.split(",").map(l => l.trim());

      for (const lancheStr of lanchesArray) {
        const qtdMatch = lancheStr.match(/\(x(\d+)\)/);
        const quantidade = qtdMatch ? parseInt(qtdMatch[1]) : 1;
        const nomeLanche = lancheStr.replace(/\(x\d+\)/, "").trim();

        // Encontrar o cd_lanche e valor pelo nome
        const lancheInfo = lanchesDisponiveis.find(l => l.nome === nomeLanche);
        if (!lancheInfo) continue;

        const vendaLanchePayload = {
          nr_recibo,
          cd_lanche: lancheInfo.cd_lanche,
          quantidade,
          valor_parcial: quantidade * Number(lancheInfo.valor)
        };

        await fetch(API_VendaLanche, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(vendaLanchePayload)
        });
      }
    }

    // 6️⃣ Recalcular total
    await fetch(`${API_Venda}/recalcular/${nr_recibo}`, { method: "PUT" });

    console.log("✅ Pedido enviado com sucesso!", { venda: vendaCriada, nr_recibo });
    return { venda: vendaCriada, nr_recibo };

  } catch (erro) {
    console.error("❌ Falha ao conectar com o servidor:", erro);
    alert("Erro de conexão com o servidor. Verifique se o back-end está rodando.");
    return null;
  }
}