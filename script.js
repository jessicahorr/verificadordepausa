// =====================================================================
// CONFIGURAÇÃO — substitua SEU_ID_AQUI pelo ID da sua planilha do Google
// Para encontrar o ID: abra a planilha e copie o trecho entre /d/ e /edit na URL
// Exemplo: docs.google.com/spreadsheets/d/ESTE_TRECHO_AQUI/edit
// =====================================================================
const SPREADSHEET_ID = "1eDRyR5r-NsSHOoYwCbKnbidYkq8xw1um6ImVzlhRY2k";

// Mapeamento das turmas para os nomes das abas (devem ser exatos)
const TURMAS = {
  "Turma104": "Turma104",
  "Turma103": "Turma103",
  "Turma201": "Turma201"
};

const PONTUACAO_MINIMA = 5;

// Cache dos dados para não buscar toda hora
let dadosCache = {};

// -----------------------------------------------------------------------
// Monta a URL CSV para uma aba específica pelo nome
// O gid (ID da aba) é buscado automaticamente via URL de exportação por nome
// -----------------------------------------------------------------------
function urlCSV(nomeDaAba) {
  const abaEncoded = encodeURIComponent(nomeDaAba);
  const urlOriginal = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${abaEncoded}&t=${Date.now()}`;
  return `https://corsproxy.io/?url=${encodeURIComponent(urlOriginal)}`;
}

// -----------------------------------------------------------------------
// Faz o parse do CSV considerando campos entre aspas (padrão do Google)
// -----------------------------------------------------------------------
function parseCSV(texto) {
  const linhas = [];
  const rows = texto.trim().split("\n");
  for (const row of rows) {
    const colunas = [];
    let atual = "";
    let dentroAspas = false;
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '"') {
        dentroAspas = !dentroAspas;
      } else if (char === "," && !dentroAspas) {
        colunas.push(atual.trim());
        atual = "";
      } else {
        atual += char;
      }
    }
    colunas.push(atual.trim());
    linhas.push(colunas);
  }
  return linhas;
}

// -----------------------------------------------------------------------
// Busca e processa os dados de uma turma
// Retorna array de objetos { nome, pontuacao }
// -----------------------------------------------------------------------
async function buscarDadosTurma(turmaKey) {
  // Retorna do cache se já buscou
  if (dadosCache[turmaKey]) return dadosCache[turmaKey];

  const url = urlCSV(TURMAS[turmaKey]);
  const response = await fetch(url);
  if (!response.ok) throw new Error("Erro ao acessar a planilha.");

  const texto = await response.text();
  const linhas = parseCSV(texto);
  console.log("Primeiras 5 linhas do CSV:", linhas.slice(0, 5));

// Encontra a linha de cabeçalho (linha com as datas, ex: '20/02')
// Os dados dos alunos começam na linha seguinte
let linhaCabecalho = -1;

for (let i = 0; i < linhas.length; i++) {
  const linha = linhas[i];
  // A linha de cabeçalho contém o número da turma (ex: '103', '104', '201')
  const temTurma = linha.some(c => /^\d{3}$/.test(c.toString().trim()));
  if (temTurma) {
    linhaCabecalho = i;
    break;
  }
}

if (linhaCabecalho === -1) throw new Error("Estrutura da planilha não reconhecida.");

colNome = 2;      // Nome do aluno está sempre na coluna 2
colTotal = 9;     // TOTAL está sempre na penúltima coluna (índice 9)

  // Processa os alunos (linhas após o cabeçalho)
  const alunos = [];
  for (let i = linhaCabecalho + 1; i < linhas.length; i++) {
    const linha = linhas[i];
    const nome = linha[colNome]?.toString().trim();
    const totalRaw = linha[colTotal]?.toString().trim();

    // Ignora linhas vazias ou sem nome
    if (!nome || nome === "") continue;

    // "F" (falta) vira 0, senão converte para número
    const pontuacao = (totalRaw === "F" || totalRaw === "f") ? 0 : parseFloat(totalRaw) || 0;

    alunos.push({ nome, pontuacao });
  }

  // Ordena alfabeticamente
  alunos.sort((a, b) => a.nome.localeCompare(b.nome));

  dadosCache[turmaKey] = alunos;
  return alunos;
}

// -----------------------------------------------------------------------
// Chamado ao trocar a turma — carrega a lista de alunos no <select>
// -----------------------------------------------------------------------
async function carregarAlunos() {
  const turmaKey = document.getElementById("turma").value;
  const alunoWrapper = document.getElementById("alunoWrapper");
  const selectAluno = document.getElementById("aluno");
  const loading = document.getElementById("loading");
  const resultado = document.getElementById("resultado");

  // Limpa resultado anterior
  resultado.style.display = "none";
  resultado.className = "";
  resultado.innerHTML = "";
  selectAluno.innerHTML = '<option value="">— Selecione o aluno —</option>';
  alunoWrapper.style.display = "none";

  if (!turmaKey) return;

  loading.style.display = "block";

  try {
    const alunos = await buscarDadosTurma(turmaKey);

    alunos.forEach(aluno => {
      const option = document.createElement("option");
      option.value = aluno.nome;
      option.textContent = aluno.nome;
      selectAluno.appendChild(option);
    });

    alunoWrapper.style.display = "block";
  } catch (erro) {
    resultado.innerHTML = `⚠️ ${erro.message} Verifique se o ID da planilha está correto e se ela está publicada na web.`;
    resultado.className = "erro";
    resultado.style.display = "block";
    console.error(erro);
  } finally {
    loading.style.display = "none";
  }
}

// -----------------------------------------------------------------------
// Chamado ao clicar em "Verificar Pausa"
// -----------------------------------------------------------------------
async function verificarPausa() {
  const turmaKey = document.getElementById("turma").value;
  const nomeAluno = document.getElementById("aluno").value;
  const resultado = document.getElementById("resultado");

  if (!turmaKey || !nomeAluno) {
    resultado.innerHTML = "Por favor, selecione a turma e o aluno.";
    resultado.className = "erro";
    resultado.style.display = "block";
    return;
  }

  try {
    // Limpa cache da turma para buscar dados frescos a cada verificação
    delete dadosCache[turmaKey];
    const alunos = await buscarDadosTurma(turmaKey);

    const aluno = alunos.find(a => a.nome === nomeAluno);

    if (!aluno) {
      resultado.innerHTML = "Aluno não encontrado. Tente recarregar a turma.";
      resultado.className = "erro";
      resultado.style.display = "block";
      return;
    }

    if (aluno.pontuacao >= PONTUACAO_MINIMA) {
      resultado.innerHTML = `✅ <strong>${aluno.nome}</strong> pode usar a pausa.<br><span style="font-size:0.9rem;opacity:0.8">Pontuação: ${aluno.pontuacao} pts</span>`;
      resultado.className = "aprovado";
    } else {
      resultado.innerHTML = `❌ <strong>${aluno.nome}</strong> não pode usar a pausa.<br><span style="font-size:0.9rem;opacity:0.8">Pontuação: ${aluno.pontuacao} pts (mínimo: ${PONTUACAO_MINIMA})</span>`;
      resultado.className = "reprovado";
    }

    resultado.style.display = "block";

    // Atualiza o select com os dados frescos
    const selectAluno = document.getElementById("aluno");
    selectAluno.innerHTML = '<option value="">— Selecione o aluno —</option>';
    alunos.forEach(a => {
      const option = document.createElement("option");
      option.value = a.nome;
      option.textContent = a.nome;
      if (a.nome === nomeAluno) option.selected = true;
      selectAluno.appendChild(option);
    });

  } catch (erro) {
    resultado.innerHTML = `⚠️ ${erro.message}`;
    resultado.className = "erro";
    resultado.style.display = "block";
    console.error(erro);
  }
}
