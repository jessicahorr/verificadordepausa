// =====================================================================
// CONFIGURAÇÃO — substitua SEU_ID_AQUI pelo ID da sua planilha do Google
// =====================================================================
const SPREADSHEET_ID = "1iaJWII2fOR8ML9ZTpy5qL9nbkbZU02raYT6AqVmx-BE";

const TURMAS = {
  "CEDUP": "CEDUP",
"102": "102",
"103": "103",
"104": "104",
"201": "201",
"202": "202",
"203": "203",
"204": "204",
"301": "301",
"302": "302",
"303": "303",
"304": "304"
};

// Cache dos dados para não buscar toda hora
let dadosCache = {};

function urlCSV(nomeDaAba) {
  const abaEncoded = encodeURIComponent(nomeDaAba);
  const urlOriginal = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${abaEncoded}&t=${Date.now()}`;
  return `https://corsproxy.io/?url=${encodeURIComponent(urlOriginal)}`;
}

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

async function buscarDadosTurma(turmaKey) {
  if (dadosCache[turmaKey]) return dadosCache[turmaKey];

  const url = urlCSV(TURMAS[turmaKey]);
  const response = await fetch(url);
  if (!response.ok) throw new Error("Erro ao acessar a planilha.");

  const texto = await response.text();
  const linhas = parseCSV(texto);

  // Encontra a linha de cabeçalho (linha com o número da turma, ex: '103', '201')
  let linhaCabecalho = -1;
  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const temTurma = linha.some(c => /^\d{3}$/.test(c.toString().trim()));
    if (temTurma) {
      linhaCabecalho = i;
      break;
    }
  }

  if (linhaCabecalho === -1) throw new Error("Estrutura da planilha não reconhecida.");

  const colNome = 2;   // Nome do aluno
  const colTotal = 9;  // Coluna TOTAL (penúltima, antes de ASSUNTOS)

  const alunos = [];
  for (let i = linhaCabecalho + 1; i < linhas.length; i++) {
    const linha = linhas[i];
    const nome = linha[colNome]?.toString().trim();
    const totalRaw = linha[colTotal]?.toString().trim();

    if (!nome || nome === "") continue;

    const pontuacao = (totalRaw === "F" || totalRaw === "f") ? 0 : parseFloat(totalRaw) || 0;
    alunos.push({ nome, pontuacao });
  }

  alunos.sort((a, b) => a.nome.localeCompare(b.nome));
  dadosCache[turmaKey] = alunos;
  return alunos;
}

async function carregarAlunos() {
  const turmaKey = document.getElementById("turma").value;
  const alunoWrapper = document.getElementById("alunoWrapper");
  const selectAluno = document.getElementById("aluno");
  const loading = document.getElementById("loading");
  const resultado = document.getElementById("resultado");

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

async function verificarPausa() {
  const turmaKey = document.getElementById("turma").value;
  const nomeAluno = document.getElementById("aluno").value;
  const resultado = document.getElementById("resultado");

  // Lê o mínimo configurado pelo professor
  const minimoInput = parseFloat(document.getElementById("minimo").value);
  if (isNaN(minimoInput) || minimoInput < 0) {
    resultado.innerHTML = "⚠️ Por favor, defina uma pontuação mínima válida.";
    resultado.className = "erro";
    resultado.style.display = "block";
    return;
  }

  if (!turmaKey || !nomeAluno) {
    resultado.innerHTML = "Por favor, selecione a turma e o aluno.";
    resultado.className = "erro";
    resultado.style.display = "block";
    return;
  }

  try {
    delete dadosCache[turmaKey];
    const alunos = await buscarDadosTurma(turmaKey);
    const aluno = alunos.find(a => a.nome === nomeAluno);

    if (!aluno) {
      resultado.innerHTML = "Aluno não encontrado. Tente recarregar a turma.";
      resultado.className = "erro";
      resultado.style.display = "block";
      return;
    }

    if (aluno.pontuacao >= minimoInput) {
      resultado.innerHTML = `✅ <strong>${aluno.nome}</strong> pode usar a pausa.<br><span style="font-size:0.9rem;opacity:0.8">Pontuação: ${aluno.pontuacao} pts (mínimo: ${minimoInput})</span>`;
      resultado.className = "aprovado";
    } else {
      resultado.innerHTML = `❌ <strong>${aluno.nome}</strong> não pode usar a pausa.<br><span style="font-size:0.9rem;opacity:0.8">Pontuação: ${aluno.pontuacao} pts (mínimo: ${minimoInput})</span>`;
      resultado.className = "reprovado";
    }

    resultado.style.display = "block";

    // Atualiza o select com dados frescos mantendo o aluno selecionado
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
