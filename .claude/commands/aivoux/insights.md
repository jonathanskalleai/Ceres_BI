# AIVOUX — Insights (Telemetria Local)

Gera um relatorio agregado a partir de `.aivoux/telemetry/events.jsonl`
mostrando padroes de uso, erros recorrentes, ferramentas mais usadas e
candidatos a documentacao/otimizacao.

Argumentos do usuario: $ARGUMENTS

Modos (baseado em $ARGUMENTS):
- `--local` (default) — relatorio para o usuario ver no terminal
- `--export` — gera arquivo `.aivoux/telemetry/export-{data}.md`
  seguro para compartilhar (totalmente anonimizado)
- `--deep` — alem dos stats, spawna @analyzer (Haiku) para inferencias
  semanticas (padroes de comportamento, sugestoes qualitativas)
- `--reset` — limpa o telemetry atual (arquiva em `events-{data}.jsonl.bak`)

---

## Protocolo

### 1. Verificar existencia

Checar se `.aivoux/telemetry/events.jsonl` existe. Se nao:
```
⚠ Nenhum dado de telemetria encontrado ainda.
  O hook de coleta foi ativado? Confira .claude/settings.json.
  Use o projeto normalmente por algumas sessoes e tente de novo.
```
E parar.

### 2. Se `--reset`: arquivar e limpar

```bash
mv .aivoux/telemetry/events.jsonl .aivoux/telemetry/events-$(date +%Y%m%d).jsonl.bak
```
Reportar "telemetria resetada" e parar.

### 3. Agregar via Bash (leve, sem LLM)

Usar `jq` e comandos shell para agregar. **Nao usar LLM para contar** — so
para interpretar depois. Comandos aproximados:

```bash
FILE=.aivoux/telemetry/events.jsonl

# Total de eventos
TOTAL=$(wc -l < "$FILE")

# Janela de tempo
FIRST=$(head -1 "$FILE" | jq -r .ts)
LAST=$(tail -1 "$FILE" | jq -r .ts)

# Top ferramentas
TOP_TOOLS=$(jq -r 'select(.type=="tool") | .tool' "$FILE" | sort | uniq -c | sort -rn | head -10)

# Taxa de erro por ferramenta
ERRORS=$(jq -r 'select(.type=="tool" and .ok==false) | .tool' "$FILE" | sort | uniq -c | sort -rn | head -10)

# Top extensoes (proxy para tipos de arquivo)
TOP_EXT=$(jq -r 'select(.type=="tool" and .ext != "") | .ext' "$FILE" | sort | uniq -c | sort -rn | head -10)

# Arquivos mais tocados (hash, nao revela path)
TOP_FILES=$(jq -r 'select(.type=="tool" and .fh != "") | .fh' "$FILE" | sort | uniq -c | sort -rn | head -10)

# Total de prompts e media de tamanho
PROMPTS=$(jq -r 'select(.type=="prompt") | .chars' "$FILE")
PROMPT_COUNT=$(echo "$PROMPTS" | wc -l)
PROMPT_AVG=$(echo "$PROMPTS" | awk '{s+=$1} END {if(NR>0) print int(s/NR); else print 0}')

# Sessoes (contadas por Stop events)
SESSIONS=$(jq -r 'select(.type=="stop")' "$FILE" | wc -l)
```

### 4. Montar relatorio (local mode)

```
═══════════════════════════════════════════════
  AIVOUX — Usage Insights
═══════════════════════════════════════════════
  Periodo:       {FIRST} — {LAST}
  Total eventos: {TOTAL}
  Sessoes:       {SESSIONS}
  Prompts:       {PROMPT_COUNT} (media {PROMPT_AVG} chars)

  Top 10 ferramentas:
    {TOP_TOOLS}

  Taxa de erro (falhas por ferramenta):
    {ERRORS}

  Extensoes mais tocadas:
    {TOP_EXT}

  Hashes de arquivos mais reincidentes (candidatos a @scribe):
    {TOP_FILES}
═══════════════════════════════════════════════
```

Analisar e adicionar **recomendacoes automaticas** baseadas nos dados:
- Se um `fh` aparece >5x: "arquivo lido/editado {N} vezes — candidato a
  `docs/features/{slug}.md` via @scribe"
- Se uma tool tem taxa de erro >20%: "tool X falha {Y}% — revisar padrao de uso"
- Se Read tem muitos erros: "possivel 'File Too Large' — use offset/limit"
- Se Bash domina (>40% das tools): "muitas operacoes shell — considere
  Grep/Glob/Read em vez de bash cat/find/rg"
- Se mesma ext aparece com muitos erros: "bugs concentrados em {ext}"

### 5. Se `--deep`: spawnar @analyzer (Haiku)

```
Task(
  subagent_type: "general-purpose",
  model: "haiku",
  description: "Analise qualitativa de telemetria",
  prompt: "Voce e @analyzer do AIVOUX. Analise os dados agregados abaixo
           e identifique padroes nao-obvios, correlacoes e sugestoes
           acionaveis para melhorar o framework.

           DADOS AGREGADOS: {relatorio do passo 4}

           Retorne em <=300 palavras:
           1. 3 padroes mais significativos
           2. 3 recomendacoes de melhoria para o framework (novos agentes,
              regras, skills, ou ajustes em config)
           3. 1 sugestao de otimizacao de tokens

           Seja especifico e acionavel, nao generico."
)
```

### 6. Se `--export`: gerar arquivo compartilhavel

Mesmo conteudo do relatorio local + analise deep (se aplicavel), MAS:

- **Remover** qualquer referencia a paths, nomes de arquivos, ou conteudo
  que possa identificar o negocio do usuario
- **Manter** apenas: hashes, contagens, extensoes genericas, tools
- Salvar em `.aivoux/telemetry/export-{YYYY-MM-DD}.md`

Header do export:
```markdown
---
aiox_lite_version: {versao do package.json}
export_date: {data}
project_hash: {md5 do caminho absoluto do projeto, curto}
period: {FIRST} — {LAST}
events: {TOTAL}
sessions: {SESSIONS}
---

# AIVOUX Telemetry Export

Este arquivo e totalmente anonimizado. Contem apenas agregados
estatisticos e nao revela nada sobre o conteudo do projeto.

Cole este arquivo na conversa do AIVOUX framework para ajudar
a melhorar futuras versoes.
```

Ao terminar, imprimir:
```
✓ Export salvo em .aivoux/telemetry/export-{data}.md
  Cole o conteudo na conversa do AIVOUX framework para feedback.
```

---

## Regras

- **NUNCA** expor paths reais, nomes de arquivos ou conteudo de prompts
- **NUNCA** usar LLM para contagem (use bash/jq)
- **SEMPRE** dar recomendacoes acionaveis, nao so estatisticas cruas
- Se jq nao existir: avisar usuario e sair (`brew install jq`)
- Manter o relatorio curto — dados visiveis em uma tela
