#!/usr/bin/env node
'use strict';

/**
 * AIVOUX Lite — PreCompact Session Digest
 *
 * Dispara antes da compactacao automatica do contexto pelo Claude Code.
 * Salva um resumo em .aivoux/session-digest.md para facilitar recuperacao
 * de contexto na proxima sessao.
 *
 * Silencioso em qualquer erro — nunca bloqueia o usuario.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TIMEOUT_MS = 8000;
const timeout = setTimeout(() => process.exit(0), TIMEOUT_MS);

// Captura barata do estado de trabalho para recuperacao pos-compactacao.
// Tudo silencioso: qualquer falha vira string vazia, nunca quebra o hook.
function sh(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

function gitState(cwd) {
  const branch = sh('git rev-parse --abbrev-ref HEAD', cwd);
  if (!branch) return ''; // nao e repo git
  const lastCommit = sh('git log -1 --pretty=format:"%h %s"', cwd);
  const status = sh('git status --porcelain', cwd)
    .split('\n').filter(Boolean).slice(0, 20).join('\n');
  const lines = ['## Estado Git (no momento da compactacao)', ''];
  lines.push(`- **Branch:** ${branch}`);
  if (lastCommit) lines.push(`- **Ultimo commit:** ${lastCommit}`);
  if (status) {
    lines.push('- **Arquivos com mudancas nao commitadas:**', '', '```', status, '```');
  } else {
    lines.push('- **Working tree:** limpo (sem mudancas pendentes)');
  }
  return lines.join('\n') + '\n';
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => {
      try { resolve(JSON.parse(data)); } catch { resolve({}); }
    });
    process.stdin.on('error', () => resolve({}));
  });
}

async function main() {
  const input = await readStdin();
  const cwd = input.cwd || process.cwd();
  const aiouxDir = path.join(cwd, '.aivoux');
  const digestPath = path.join(aiouxDir, 'session-digest.md');

  if (!fs.existsSync(aiouxDir)) {
    clearTimeout(timeout);
    return;
  }

  const now = new Date().toISOString();
  const trigger = input.trigger || 'auto';

  // Verificar se existe handoff ativo para incluir no digest
  let handoffNote = '';
  try {
    const handoffPath = path.join(aiouxDir, 'handoffs', 'latest.yaml');
    if (fs.existsSync(handoffPath)) {
      const content = fs.readFileSync(handoffPath, 'utf8');
      if (content.includes('consumed: false')) {
        handoffNote = '\n## Handoff Pendente\n\nExiste um handoff nao consumido em `.aivoux/handoffs/latest.yaml`.\nLeia-o ao ativar o proximo agente.\n';
      }
    }
  } catch {
    // silencioso
  }

  const digest = [
    '# AIVOUX Session Digest',
    '',
    `**Compactado em:** ${now}`,
    `**Trigger:** ${trigger}`,
    '',
    gitState(cwd),
    '## Instrucao para nova sessao',
    '',
    'Este arquivo marca uma compactacao de contexto. Use o estado git acima',
    'para reconstruir rapidamente onde o trabalho parou (arquivos em andamento).',
    'Verifique `.aivoux/handoffs/latest.yaml` para contexto do ultimo agente ativo.',
    'Use `/aivoux/router` para continuar o trabalho normalmente.',
    handoffNote,
  ].join('\n');

  try {
    fs.writeFileSync(digestPath, digest, 'utf8');
  } catch {
    // silencioso
  }

  clearTimeout(timeout);
}

main().catch(() => {
  clearTimeout(timeout);
  process.exit(0);
});
