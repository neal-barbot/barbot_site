import { spawn } from 'node:child_process';
import path from 'node:path';

import { envConfigs } from '@/config';

const ANSI_RE = /\u001b\[[0-9;]*m/g;

export interface PiAgentWikiParams {
  question: string;
  contextMarkdown: string;
}

export interface PiAgentWikiResult {
  answer: string;
  rawStdout: string;
  rawStderr: string;
  exitCode: number;
}

export class PiAgentExecutionError extends Error {
  constructor(
    message: string,
    readonly result: PiAgentWikiResult
  ) {
    super(message);
    this.name = 'PiAgentExecutionError';
  }
}

function piAgentCliPath() {
  return path.join(envConfigs.pi_agent_root, 'packages/coding-agent/dist/cli.js');
}

function timeoutMs() {
  const parsed = Number(envConfigs.pi_agent_timeout_ms);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 90000;
}

function wikiSystemPrompt() {
  return [
    '你是一个面向汽车电子硬件学习的费曼教练。',
    '你只根据用户注入的 context.md 回答，不要编造 context.md 之外的器件型号、参数或事实。',
    '如果用户框选了图片区域，要先解释这个区域可能对应的器件/模块，再解释为什么这样设计。',
    '回答结构固定为：1) 这是什么 2) 为什么这么设计 3) 怎么验证/继续学习 4) 资料依据。',
    '回答不超过 600 个中文字符，优先给结论，不要展开长篇背景。',
    '用中文回答，保持专业但适合学习者理解。',
  ].join('\n');
}

function buildPrompt(params: PiAgentWikiParams) {
  return [
    '下面是当前网页选中的资料上下文，请严格围绕它回答。',
    '',
    params.contextMarkdown,
    '',
    '## Answering task',
    `请回答用户问题：${params.question}`,
  ].join('\n');
}

export async function askPiAgentForWiki(params: PiAgentWikiParams): Promise<PiAgentWikiResult> {
  const args = [
    piAgentCliPath(),
    '--print',
    '--no-session',
    '--no-tools',
    '--no-context-files',
    '--no-extensions',
    '--no-skills',
    '--system-prompt',
    wikiSystemPrompt(),
  ];

  if (envConfigs.pi_agent_provider) {
    args.push('--provider', envConfigs.pi_agent_provider);
  }

  if (envConfigs.pi_agent_model) {
    args.push('--model', envConfigs.pi_agent_model);
  }

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: envConfigs.pi_agent_root,
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGTERM');
      reject(new PiAgentExecutionError(`pi-agent timed out after ${timeoutMs()}ms`, {
        answer: stdout.replace(ANSI_RE, '').trim(),
        rawStdout: stdout,
        rawStderr: stderr,
        exitCode: 124,
      }));
    }, timeoutMs());

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      const cleanStdout = stdout.replace(ANSI_RE, '').trim();
      const cleanStderr = stderr.replace(ANSI_RE, '').trim();

      if (code !== 0) {
        reject(new PiAgentExecutionError(cleanStderr || cleanStdout || `pi-agent exited with code ${code}`, {
          answer: cleanStdout,
          rawStdout: stdout,
          rawStderr: stderr,
          exitCode: code ?? 1,
        }));
        return;
      }

      if (!cleanStdout) {
        reject(new PiAgentExecutionError(cleanStderr || 'pi-agent returned an empty answer', {
          answer: cleanStdout,
          rawStdout: stdout,
          rawStderr: stderr,
          exitCode: code ?? 0,
        }));
        return;
      }

      resolve({
        answer: cleanStdout,
        rawStdout: stdout,
        rawStderr: stderr,
        exitCode: code ?? 0,
      });
    });

    child.stdin.end(buildPrompt(params));
  });
}
