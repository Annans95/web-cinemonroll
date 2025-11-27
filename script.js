/*
  script.js
  ---------
  Controle da página de checkout do CineStar.

  Principais responsabilidades:
  - Capturar clique nos botões de "comprar" na listagem de filmes e salvar o filme selecionado em localStorage
  - Gerar dinamicamente a planta de assentos (A1..E8)
  - Gerir seleção de assentos e tipos de ingresso por assento
  - Gerir lanches (quantidade) e campos extras por unidade (ex: sabor da pipoca)
  - Atualizar resumo do pedido e calcular preços, aplicando multiplicadores de sessão
  - Mostrar modal de confirmação e modal de sucesso
*/

// --- Botões de compra na página principal (index.html) ---
// Salva APENAS o filme escolhido, SEM definir sessão
const buyButtons = document.querySelectorAll(".buy-btn");

buyButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const selectedMovie = btn.dataset.movie;
    // Salva apenas o título do filme
    localStorage.setItem("selectedMovie", selectedMovie);
    // Redireciona para checkout onde o usuário escolherá a sessão
    window.location.href = "checkout.html";
  });
});

// === MAPEAMENTO DE FILMES PARA cd_filme ===
// Converte título do filme para o ID no banco de dados
function mapFilme(titulo) {
  const mapa = {
    "Vingadores: Ultimato": 1,
    "Coringa": 2,
    "Homem-Aranha no Aranhaverso": 3,
    "Frozen II": 4,
    "Avatar: O Caminho da Água": 5,
    "The Batman": 6,
    "Barbie": 7,
    "Oppenheimer": 8
  };
  return mapa[titulo] || null;
}

// === MAPEAMENTO DE TIPO DE SESSÃO PARA cd_sala ===
// Converte o tipo de sessão (ex: "2D-dub") para o código da sala no banco
function mapTipoSessao(tipoSessao) {
  const mapa = {
    "2D-dub": 1,
    "2D-leg": 2,
    "3D-dub": 3,
    "3D-leg": 4,
    "IMAX-dub": 5,
    "IMAX-leg": 6
  };
  return mapa[tipoSessao] || null;
}

  // === Código executado apenas na página de checkout ===
  if (window.location.pathname.includes("checkout.html")) {
    // Elemento que mostra o título do filme no topo
    const movieTitleEl = document.getElementById("movie-title");
    // Recupera o filme salvo em localStorage pela página anterior
    const movieName = localStorage.getItem("selectedMovie");
    if (movieName) movieTitleEl.textContent = movieName;

    // Variável global para armazenar o ID da sessão escolhida
    let sessaoIdGlobal = null;
    // Variável global para armazenar as sessões filtradas (será usada ao enviar pedido)
    let sessoesDoFilme = [];
    
    // --- Buscar e popular sessões disponíveis ---
    async function carregarSessoesDisponiveis() {
      try {
        const cd_filme = mapFilme(movieName);
        if (!cd_filme) {
          alert("❌ Filme não encontrado no sistema.");
          window.location.href = "index.html";
          return;
        }

        // Pega o tipo de sessão selecionado
        const sessionTypeEl = document.getElementById("session-type");
        const tipoSessao = sessionTypeEl ? sessionTypeEl.value : "";
        
        if (!tipoSessao) {
          // Se não selecionou tipo de sessão ainda, limpa o select de horários
          const showtimeSelect = document.getElementById("showtime");
          showtimeSelect.innerHTML = '<option value="">Primeiro selecione o tipo de sessão</option>';
          return;
        }

        const cd_sala = mapTipoSessao(tipoSessao);
        if (!cd_sala) {
          alert("❌ Tipo de sessão inválido.");
          return;
        }

        const resposta = await fetch(API_Sessao, { method: "GET" });
        if (!resposta.ok) {
          alert("❌ Erro ao buscar sessões. Verifique se o back-end está rodando.");
          return;
        }

        const todasSessoes = await resposta.json();
        // Filtra sessões pelo filme E pela sala (tipo de sessão)
        const sessoesFiltradasPorFilmeESala = todasSessoes.filter(s => 
          s.cd_filme === cd_filme && s.cd_sala === cd_sala
        );

        // Atualiza a variável global com as sessões filtradas
        sessoesDoFilme = sessoesFiltradasPorFilmeESala;

        if (sessoesFiltradasPorFilmeESala.length === 0) {
          const showtimeSelect = document.getElementById("showtime");
          showtimeSelect.innerHTML = '<option value="">Nenhuma sessão disponível para este tipo</option>';
          console.log("⚠️ Nenhuma sessão encontrada para:", { cd_filme, cd_sala });
          return;
        }

        // Popular o select de horários apenas com as sessões filtradas
        const showtimeSelect = document.getElementById("showtime");
        showtimeSelect.innerHTML = '<option value="">Selecione um horário</option>';
        
        sessoesFiltradasPorFilmeESala.forEach(sessao => {
          const option = document.createElement("option");
          option.value = sessao.cd_sessao; // ID numérico real
          // Formata e mostra "Sessão" + horário do banco de dados
          const dataHora = new Date(sessao.data_hora);
          const horario = dataHora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          option.textContent = `Sessão ${horario}`;
          showtimeSelect.appendChild(option);
        });

        console.log("✅ Sessões carregadas (filme + sala):", sessoesFiltradasPorFilmeESala);
      } catch (erro) {
        console.error("❌ Erro ao carregar sessões:", erro);
        alert("❌ Erro de conexão com o servidor.");
      }
    }

    // Sessões serão carregadas quando o usuário selecionar o tipo de sessão

    // --- Função para carregar assentos ocupados do backend ---
    async function carregarAssentosOcupados() {
      try {
        // Usa o sessaoId selecionado pelo usuário
        if (!sessaoIdGlobal) {
          console.warn("⚠️ Nenhuma sessão selecionada ainda.");
          return;
        }

        // Limpa ocupados anteriores
        document.querySelectorAll('.seat.occupied').forEach(s => s.classList.remove('occupied'));

        const url = `${API_Assento}/sessao/${sessaoIdGlobal}`;
        console.log("🔍 Buscando assentos ocupados:", url);
        
        const resposta = await fetch(url);
        if (resposta.ok) {
          const data = await resposta.json();
          let assentosOcupados = [];
          
          if (Array.isArray(data)) {
            assentosOcupados = data
              .filter(a => a.ocupado === true)
              .map(a => a.numero_assento ?? a.assento ?? a);
          } else if (Array.isArray(data.assentos)) {
            assentosOcupados = data.assentos;
          }

          assentosOcupados.forEach(id => {
            const seatElement = document.querySelector(`[data-id="${id}"]`);
            if (seatElement) {
              seatElement.classList.add("occupied");
              seatElement.classList.remove('selected');
            }
          });

          console.log("✅ Assentos ocupados:", assentosOcupados);
        } else if (resposta.status === 404) {
          console.log("ℹ️ Todos os assentos disponíveis.");
        } else {
          console.warn("⚠️ Erro ao carregar assentos:", resposta.status);
        }
      } catch (erro) {
        console.error("❌ Erro ao conectar:", erro);
      }
    }  // --- Geração da planta de assentos ---
  // Busca o container dos assentos e cria um grid (A1..E8) em ordem de linhas (horizontal)
  const seatsContainer = document.getElementById("seats");
  if (seatsContainer) {
    const rows = 5;
    const cols = 8;
    const rowLetters = ["A", "B", "C", "D", "E"];

    // criar assentos por fileira (A1..A8, B1..B8, ...)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const seat = document.createElement("div");
        seat.classList.add("seat");
        const label = `${rowLetters[r]}${c + 1}`;
        // armazenamos o rótulo legível (ex: A1) em data-id para uso posterior
        seat.dataset.id = label;
        // mostrar o rótulo visível no próprio elemento
        seat.textContent = label;
        seat.title = `Assento ${label}`;
        seatsContainer.appendChild(seat);
      }
    }

  // NÃO carrega assentos automaticamente - aguarda usuário escolher horário

    // Delegação de clique para selecionar/deselecionar assentos
    seatsContainer.addEventListener("click", (e) => {
      if (e.target.classList.contains("seat") && !e.target.classList.contains("occupied")) {
        // alterna estado .selected e atualiza UI relacionada
        e.target.classList.toggle("selected");
        updateTicketSelection(); // atualiza selects por assento
        updateSummary(); // recalcula o resumo
      }
    });
  }

  // --- Máscara simples para CPF (apenas formatação visual) ---
  const cpfInput = document.getElementById("cpf");
  if (cpfInput) {
    cpfInput.addEventListener("input", function (e) {
      // remove tudo que não é número e aplica as pontuações automaticamente
      let value = e.target.value.replace(/\D/g, "");
      value = value.replace(/(\d{3})(\d)/, "$1.$2");
      value = value.replace(/(\d{3})(\d)/, "$1.$2");
      value = value.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
      e.target.value = value;
    });
  }

  // Quando usuário escolhe um horário, salva o sessaoId e carrega assentos
  const showtimeEl = document.getElementById("showtime");
  const sessionTypeEl = document.getElementById("session-type");

  if (showtimeEl) {
    showtimeEl.addEventListener("change", () => {
      // O value agora é o cd_sessao numérico real
      sessaoIdGlobal = parseInt(showtimeEl.value) || null;
      if (sessaoIdGlobal) {
        console.log("✅ Sessão selecionada:", sessaoIdGlobal);
        carregarAssentosOcupados();
      }
      updateSummary();
    });
  }

  if (sessionTypeEl) {
    sessionTypeEl.addEventListener("change", () => {
      // Quando tipo de sessão muda, recarrega os horários filtrados
      carregarSessoesDisponiveis();
      updateSummary();
    });
  }
  document.querySelectorAll("input[name='payment']").forEach(r => r.addEventListener("change", updateSummary));

  // === SISTEMA DE LANCHES (quantidade + extras por unidade) ===
  const snackItems = document.querySelectorAll(".item");

  snackItems.forEach(item => {
    const minusBtn = item.querySelector(".minus");
    const plusBtn = item.querySelector(".plus");
    const quantityEl = item.querySelector(".quantity");
    const extraBox = item.querySelector(".extra");

    // diminuir quantidade
    minusBtn.addEventListener("click", () => {
      let qty = parseInt(quantityEl.textContent);
      if (qty > 0) {
        quantityEl.textContent = qty - 1;
        if (extraBox) updateExtraVisibility();
        updateSummary();
      }
    });

    // aumentar quantidade
    plusBtn.addEventListener("click", () => {
      let qty = parseInt(quantityEl.textContent);
      quantityEl.textContent = qty + 1;
      if (extraBox) updateExtraVisibility();
      updateSummary();
    });

    // Função interna: mostra/oculta a caixa de extras e gera campos por unidade
    const updateExtraVisibility = () => {
      const quantity = parseInt(quantityEl.textContent);
      if (quantity > 0) {
        extraBox.classList.remove('hidden');
        // se o elemento possui data-extra (tipo: 'pipoca' ou 'fini'), renderizamos selects individuais
        if (item.dataset.extra) {
          renderExtraFields(item, quantity);
        }
      } else {
        extraBox.classList.add('hidden');
      }
    };
  });

  // --- renderExtraFields(item, quantity) ---
  // Cria selects individuais para cada unidade de um produto que possui extras (ex: sabor da pipoca)
  function renderExtraFields(item, quantity) {
    const extraBox = item.querySelector('.extra');
    const extraType = item.dataset.extra; // p.ex. 'pipoca' ou 'fini'
    // Captura as opções originais do select (armazena em cache em item._cachedExtraOptions)
    let options = [];
    const originalSelect = extraBox.querySelector('select');
    if (originalSelect) {
      options = Array.from(originalSelect.options).map(o => ({ value: o.value, text: o.textContent }));
      // cache para não perder ao reconstruir o DOM
      item._cachedExtraOptions = options;
    } else if (item._cachedExtraOptions) {
      options = item._cachedExtraOptions;
    } else {
      // sem opções conhecidas, nada a fazer
      return;
    }

    // prepara container das extra-fields e limpa conteúdo anterior
    let extraFieldsContainer = extraBox.querySelector('.extra-fields');
    if (!extraFieldsContainer) {
      extraFieldsContainer = document.createElement('div');
      extraFieldsContainer.className = 'extra-fields';
      extraBox.innerHTML = '';
      extraBox.appendChild(extraFieldsContainer);
    } else {
      extraFieldsContainer.innerHTML = '';
    }

    // Criar um select para cada unidade (1..quantity)
    for (let i = 1; i <= quantity; i++) {
      const fieldWrapper = document.createElement('div');
      fieldWrapper.className = 'extra-field-wrapper';
      fieldWrapper.style.marginBottom = '10px';

      const label = document.createElement('label');
      label.style.display = 'block';
      label.style.marginBottom = '5px';
      label.style.fontWeight = '600';
      
      // rótulo amigável dependendo do tipo de extra
      if (extraType === 'pipoca') {
        label.textContent = `${i}️⃣ Sabor:`;
      } else if (extraType === 'fini') {
        label.textContent = `${i}️⃣ Tipo:`;
      }

      const select = document.createElement('select');
      select.className = 'extra-select';
      select.setAttribute('data-item-index', i);
      // estilos inline para combinar com o tema escuro
      select.style.width = '100%';
      select.style.padding = '8px';
      select.style.borderRadius = '6px';
      select.style.border = '1px solid #444';
      select.style.backgroundColor = '#333';
      select.style.color = '#fff';
      select.style.cursor = 'pointer';

      // Popular opções capturadas
      options.forEach(opt => {
        const newOption = document.createElement('option');
        newOption.value = opt.value;
        newOption.textContent = opt.text;
        select.appendChild(newOption);
      });

      // ao alterar um extra, atualiza o resumo
      select.addEventListener('change', updateSummary);

      fieldWrapper.appendChild(label);
      fieldWrapper.appendChild(select);
      extraFieldsContainer.appendChild(fieldWrapper);
    }
  }

  // --- Finalizar compra: validação, cálculo e modais ---
  const finalizarBtn = document.getElementById("finalizar-btn");
  if (finalizarBtn) {
    finalizarBtn.addEventListener("click", () => {
      const selectedSeats = document.querySelectorAll(".seat.selected");
      const showtime = document.getElementById("showtime").value;
      const sessionSelect = document.getElementById("session-type");
      // sessionValue = valor da option (ex: '3D-dub'), sessionTypeLabel = texto legível (ex: '3D Dublado')
      const sessionValue = sessionSelect ? sessionSelect.value : "";
      const sessionTypeLabel = sessionSelect ? sessionSelect.options[sessionSelect.selectedIndex]?.text : "";
      const email = document.getElementById("email").value;
      const name = document.getElementById("nome").value;
      const cpf = document.getElementById("cpf").value;
      const payment = document.querySelector('input[name="payment"]:checked')?.value;

      // Verificar se um filme foi selecionado (proteção adicional)
      if (!movieName) {
        alert("⚠️ Por favor, selecione um filme antes de finalizar a compra.");
        window.location.href = "index.html";
        return;
      }

      // CPF não é obrigatório; validar apenas email e demais campos requeridos
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const isValidEmail = emailRegex.test(email);

      if (!name || !showtime || !sessionValue || !email || !isValidEmail || !payment || selectedSeats.length === 0) {
        if (!isValidEmail && email) {
          alert("⚠️ Por favor, insira um e-mail válido (exemplo: exemplo@email.com).");
        } else {
          alert("⚠️ Por favor, preencha todos os campos e selecione um método de pagamento.");
        }
        return;
      }

      // preço base por assento (antes de aplicar multiplicador de sessão)
      let basePrice = 20;

      // aplica acréscimos por tipo de sessão — usamos a parte antes do '-' (ex: '3D' de '3D-dub')
      const baseSession = sessionValue.split('-')[0];
      if (baseSession === "3D") basePrice *= 1.12;
      else if (baseSession === "IMAX") basePrice *= 1.25;

      basePrice = Math.round(basePrice);

      const seatTotal = selectedSeats.length * basePrice;

      // Cálculo dos snacks (simples somatório)
      const snackItemsAll = document.querySelectorAll(".item");
      let snackTotal = 0;
      let snackNames = [];

      snackItemsAll.forEach(item => {
        const qty = parseInt(item.querySelector(".quantity").textContent);
        const price = parseFloat(item.dataset.price);
        const name = item.dataset.name;

        if (qty > 0) {
          snackTotal += qty * price;
          snackNames.push(`${name} (x${qty})`);
        }
      });

      snackNames = snackNames.length ? snackNames.join(", ") : "Nenhum";
      const total = seatTotal + snackTotal;

      // Modal de confirmação (construído dinamicamente)
      const modal = document.createElement("div");
      modal.innerHTML = `
        <div id="confirm-modal" style="
          position: fixed;
          top: 0; left: 0; width: 100%; height: 100%;
          background: rgba(0,0,0,0.6);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000;
        ">
          <div style="
            background: #fff;
            color: #333;
            padding: 25px;
            border-radius: 12px;
            width: 90%;
            max-width: 400px;
            text-align: center;
            box-shadow: 0 5px 20px rgba(0,0,0,0.3);
            animation: fadeIn 0.3s ease;
          ">
            <h2 style="margin-bottom: 15px;">Confirme sua compra</h2>
            <p><b>Filme:</b> ${movieName}</p>
            <p><b>Sessão:</b> ${sessionTypeLabel}</p>
            <p><b>Horário:</b> ${showtime}</p>
            <p><b>Assentos:</b> ${selectedSeats.length}</p>
            <p><b>Lanches:</b> ${snackNames}</p>
            <p><b>Forma de Pagamento:</b> ${payment}</p>
            <p style="margin-top:10px; font-weight:bold; font-size:1.2em;">
              Total: R$ ${total.toFixed(2).replace('.', ',')}
            </p>

            <div style="margin-top:20px; display:flex; justify-content:space-around;">
              <button id="cancelar" style="
                background:#ccc; border:none; padding:10px 20px;
                border-radius:8px; cursor:pointer;">Cancelar</button>
              <button id="confirmar" style="
                background:#28a745; border:none; color:white;
                padding:10px 20px; border-radius:8px; cursor:pointer;">Confirmar</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      document.getElementById("cancelar").addEventListener("click", () => {
        modal.remove();
      });

      document.getElementById("confirmar").addEventListener("click", async () => {
        // fecha modal de confirmação e mostra modal de sucesso
        modal.remove();

        // monta o objeto com os dados da compra
        // Extrai os IDs dos assentos selecionados (ex: ["A1", "B3", "C5"])
        const assentosIds = Array.from(selectedSeats).map(seat => seat.dataset.id);

        const dados = {
          cd_cliente: 1, // valor fixo temporário
          nome: name,
          email: email,
          cpf: cpf,
          sessao: sessionTypeLabel,
          sessaoId: sessaoIdGlobal,  // usa o ID gerado pelo servidor
          horario: showtime,
          assentos: assentosIds,  // agora envia os IDs específicos dos assentos
          quantidadeAssentos: selectedSeats.length,
          lanches: snackNames,
          pagamento: payment,
          total: total,
          sessoesDoFilme: sessoesDoFilme  // passa as sessões filtradas para o api.js
      };

        // Envia pedido ao back-end (função definida em api.js) e só prossegue em caso de sucesso
        let resultadoPedido = null;
        try {
          resultadoPedido = await enviarPedido(dados);
        } catch (e) {
          console.error("Erro ao enviar pedido:", e);
          resultadoPedido = null;
        }
        if (!resultadoPedido) {
          // Não exibe modal de sucesso se houve erro no servidor ou conexão
          return;
        }

        // cria modal estilizado de sucesso
        const successModal = document.createElement("div");
        successModal.id = "success-modal-overlay";
        successModal.innerHTML = `
          <div id="success-modal" style="
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            display: flex; align-items: center; justify-content: center;
            z-index: 1100;
          ">
            <div style="
              background: #111;
              color: #fff;
              padding: 25px;
              border-radius: 12px;
              width: 90%;
              max-width: 420px;
              text-align: center;
              box-shadow: 0 8px 30px rgba(0,0,0,0.6);
            ">
              <h2 style="margin-bottom:10px;color:#ffb800;font-family:'Poppins', sans-serif;">✅ Compra confirmada</h2>
              <p style="margin-bottom:8px;">O ingresso foi enviado para o seu email:</p>
              <p style="font-weight:700;margin-bottom:12px;">${email}</p>
              <p style="color:#ddd;margin-bottom:16px;font-size:0.95rem;">Enviamos o(s) ingresso(s) e as instruções para retirada por e-mail. Obrigado pela sua compra!</p>
              <div style="display:flex;justify-content:center;gap:12px;">
                <button id="success-ok" style="background:#28a745;border:none;color:#fff;padding:10px 18px;border-radius:8px;cursor:pointer;">OK</button>
              </div>
              <p style="font-size:0.85rem;color:#999;margin-top:12px;">Você será redirecionado para a página inicial em 20 segundos ou clique OK para voltar agora.</p>
            </div>
          </div>
        `;

        document.body.appendChild(successModal);

        const finish = () => {
          localStorage.clear();
          window.location.href = "index.html";
        };

        document.getElementById("success-ok").addEventListener("click", finish);

        // redireciona automaticamente após 20s
        setTimeout(finish, 20000);
      });
    });
  }

  // --- Atualiza o resumo do pedido ---
  function updateSummary() {
    const selectedSeats = document.querySelectorAll(".seat.selected");
    const showtime = document.getElementById("showtime").value || "—";
    const sessionSelect = document.getElementById("session-type");
    const sessionValue = sessionSelect ? sessionSelect.value : ""; // ex: '3D-dub'
    const sessionType = sessionSelect ? sessionSelect.options[sessionSelect.selectedIndex]?.text || "—" : "—"; // ex: '3D Dublado'
    const payment = document.querySelector('input[name="payment"]:checked')?.value || "—";

    // Preços base por tipo de ingresso (mapa)
    const ticketPrices = {
      inteira: 20,
      "meia-estudante": 10,
      "meia-senior": 10,
      "meia-pcd": 10,
      "meia-acomp-pcd": 10,
      "meia-prof": 10,
      "meia-outras": 10
    };

    // Função que aplica multiplicador de sessão ao preço base
    const applySessionMultiplier = (basePrice) => {
      // sessionValue contém valor como '3D-dub' ou 'IMAX-leg'
      const baseSession = sessionSelect ? (sessionSelect.value.split('-')[0]) : "";
      if (baseSession === "3D") return Math.round(basePrice * 1.12);
      else if (baseSession === "IMAX") return Math.round(basePrice * 1.25);
      return basePrice;
    };

    // Calcular total de assentos com base nos tipos selecionados para cada assento
    let seatTotal = 0;
    selectedSeats.forEach(seat => {
      // Usa o mesmo identificador usado nos selects (data-id como "A1", "B3", ...)
      const seatNumber = seat.dataset.id;
      const ticketSelect = document.querySelector(`.ticket-type-select[data-seat="${seatNumber}"]`);
      const ticketType = ticketSelect ? ticketSelect.value : "";
      
      if (ticketType && ticketPrices[ticketType]) {
        const basePrice = ticketPrices[ticketType];
        const finalPrice = applySessionMultiplier(basePrice);
        seatTotal += finalPrice;
      }
    });

    // Cálculo dos snacks com detalhe de extras (se existirem campos individuais)
    const snackItemsAll = document.querySelectorAll(".item");
    let snackTotal = 0;
    let snackNames = [];

    snackItemsAll.forEach(item => {
      const qty = parseInt(item.querySelector(".quantity").textContent);
      const price = parseFloat(item.dataset.price);
      const name = item.dataset.name;
      const extraBox = item.querySelector(".extra");
      const extraType = item.dataset.extra;

      if (qty > 0) {
        snackTotal += qty * price;
        
        // Se existem selects individuais, lista os valores escolhidos
        if (extraBox && extraType && !extraBox.classList.contains('hidden')) {
          const selects = extraBox.querySelectorAll('.extra-select');
          if (selects.length > 0) {
            const details = [];
            selects.forEach(select => {
              const value = select.value;
              details.push(value);
            });
            snackNames.push(`${name} (x${qty}): ${details.join(', ')}`);
          } else {
            snackNames.push(`${name} (x${qty})`);
          }
        } else {
          snackNames.push(`${name} (x${qty})`);
        }
      }
    });

    snackNames = snackNames.length ? snackNames.join(", ") : "Nenhum";

    const total = seatTotal + snackTotal;

    // Atualiza o HTML do resumo com os dados calculados
    const summary = document.getElementById("summary-content");
    if (summary) {
      summary.innerHTML = `
        <b>Filme:</b> ${movieName}<br>
        <b>Tipo de Sessão:</b> ${sessionType}<br>
        <b>Horário:</b> ${showtime}<br>
        <b>Assentos:</b> ${selectedSeats.length || "Nenhum"}<br>
        <b>Lanches:</b> ${snackNames}<br>
        <b>Forma de Pagamento:</b> ${payment}<br>
        <hr style="border:none;border-top:1px solid #444;margin:10px 0;">
        <b>Total Assentos:</b> R$ ${seatTotal.toFixed(2).replace('.', ',')}<br>
        <b>Total Lanches:</b> R$ ${snackTotal.toFixed(2).replace('.', ',')}<br>
        <div style="margin-top:10px;font-size:1.2rem;color:#ff4b2b;font-weight:bold;">
          Total Geral: R$ ${total.toFixed(2).replace('.', ',')}
        </div>
      `;
    }
  }

  // --- Geração dos selects por assento (quando o usuário seleciona assentos) ---
  function updateTicketSelection() {
    const selectedSeats = document.querySelectorAll(".seat.selected");
    const ticketContainer = document.getElementById("ticket-selection-container");
    const ticketList = document.getElementById("ticket-selection-list");

    if (selectedSeats.length === 0) {
      ticketContainer.classList.add("hidden");
      ticketList.innerHTML = "";
      return;
    }

    ticketContainer.classList.remove("hidden");
    ticketList.innerHTML = "";

    selectedSeats.forEach((seat, index) => {
      // Se por algum motivo o assento não tiver data-id, cria um index (fallback)
      if (!seat.dataset.id) {
        const allSeats = document.querySelectorAll(".seat");
        const seatIndex = Array.from(allSeats).indexOf(seat);
        seat.dataset.id = seatIndex + 1;
      }
      const seatNumber = seat.dataset.id;
      
      const seatDiv = document.createElement("div");
      
      seatDiv.innerHTML = `
        <label>Assento ${seatNumber}:</label>
        <select class="ticket-type-select" data-seat="${seatNumber}">
          <option value="">Selecione o tipo</option>
          <option value="inteira">Inteira — R$ 20,00</option>
          <option value="meia-estudante">Meia Estudante — R$ 10,00</option>
          <option value="meia-senior">Meia Sênior (60+) — R$ 10,00</option>
          <option value="meia-pcd">Meia PCD / Autistas — R$ 10,00</option>
          <option value="meia-acomp-pcd">Meia Acomp. PCD — R$ 10,00</option>
          <option value="meia-prof">Meia Prof. Ensino — R$ 10,00</option>
          <option value="meia-outras">Outras Meias (por lei) — R$ 10,00</option>
        </select>
      `;
      
      ticketList.appendChild(seatDiv);
    });

    // Adicionar event listeners aos selects para que qualquer alteração recalcule o resumo
    document.querySelectorAll(".ticket-type-select").forEach(select => {
      select.addEventListener("change", updateSummary);
    });
  }
}