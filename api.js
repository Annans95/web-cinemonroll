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
const BASE_URL = "apisistemaingresso-production.up.railway.app"
const API_URL = `${BASE_URL}/venda`;
const API_Filme = `${BASE_URL}/filme`;
const API_Sala = `${BASE_URL}/sala`;
const API_Sessao = `${BASE_URL}/sessao`;
const API_Venda = `${BASE_URL}/venda`;
const API_Ingresso = `${BASE_URL}/ingresso`;
const API_Lanche = `${BASE_URL}/lanche`;
const API_VendaLanche = `${BASE_URL}/venda-lanche`;
const API_Assento = `${BASE_URL}/assento`;

/*  Função para enviar os dados da compra ao back-end */
async function enviarPedido(dadosCompra) {
  try {
    // Envia o pedido como JSON
    const resposta = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dadosCompra),
    });

    // Tenta interpretar a resposta como JSON
    const resultado = await resposta.json().catch(() => null);

    if (resposta.ok) {
      console.log("✅ Pedido enviado com sucesso!", resultado);
      return resultado;
    } else {
      console.error("⚠️ Erro na requisição:", resultado);
      alert(resultado?.mensagem || "Erro ao processar o pedido.");
      return null;
    }
  } catch (erro) {
    console.error("❌ Falha ao conectar com o servidor:", erro);
    alert("Erro de conexão com o servidor. Verifique se o back-end está rodando.");
    return null;
  }
}