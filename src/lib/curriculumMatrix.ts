import Ajv from 'ajv';
import {supabase} from './supabaseClient';
import schema from '../contracts/curriculum-matrix.v1.schema.json';

export type MatrixMode = 'create' | 'complement' | 'update';
export type MatrixAction = MatrixMode | 'unchanged' | 'conflict';
export type MatrixRow = {
  depth: number;
  path: string;
  parent: string | null;
  id: string | null;
  title: string;
  action: MatrixAction;
  match?: 'id' | 'key' | 'title';
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  issue?: string;
  preserved?: string[];
};
export type MatrixReport = {
  courseId: string | null;
  courseTitle: string;
  rows: MatrixRow[];
  counts: Partial<Record<MatrixAction, number>>;
  conflicts: string[];
  token?: string;
};

const validate = new Ajv().compile(schema);
const maxBytes = 1_000_000;

export async function readMatrix(file: File): Promise<unknown> {
  if (file.size > maxBytes) throw new Error('O arquivo JSON deve ter até 1 MB.');
  let document: unknown;
  try {
    document = JSON.parse((await file.text()).replace(/^\uFEFF/, ''));
  } catch {
    throw new Error('O arquivo contém JSON inválido.');
  }
  if (!validate(document)) {
    const error = validate.errors?.[0];
    const property = error && ('missingProperty' in error.params ? error.params.missingProperty :
      'additionalProperty' in error.params ? error.params.additionalProperty : null);
    const path = ['matriz' + (error?.dataPath ?? ''), property].filter(Boolean).join('.');
    throw new Error(`Valor inválido em ${path}. Confira o campo e o tipo no schema oficial.`);
  }
  return document;
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const {data, error} = await supabase.rpc(name, args);
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883')
      throw new Error('O importador de matriz curricular ainda não está instalado neste ambiente.');
    throw new Error(error.message);
  }
  return data as T;
}

export const exportMatrix = (course: string) => rpc<unknown>('export_curriculum_matrix', {p_course: course});

export function previewMatrix(mode: MatrixMode, course: string | null, document: unknown) {
  return rpc<MatrixReport>('preview_curriculum_matrix', {p_mode: mode, p_course: course, p_document: document});
}

export function confirmMatrix(mode: MatrixMode, course: string | null, document: unknown, token: string) {
  return rpc<MatrixReport>('confirm_curriculum_matrix', {
    p_mode: mode, p_course: course, p_document: document, p_token: token, p_confirmed: true,
  });
}

export function downloadMatrixFile(value: unknown, name: string) {
  let body = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  if (typeof value !== 'string' && new TextEncoder().encode(body).length > maxBytes) {
    body = JSON.stringify(value);
  }
  const type = name.endsWith('.json') ? 'application/json' : 'text/markdown';
  const url = URL.createObjectURL(new Blob([body], {type}));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
