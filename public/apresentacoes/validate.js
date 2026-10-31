/** Validates the deliberately small JSON Schema subset used by this template. */
export function validatePresentation(value, schema) {
  const errors = [];
  function visit(item, rule, path, out) {
    if (rule.oneOf) {
      const matches = rule.oneOf.filter(option => { const failures = []; visit(item, option, path, failures); return failures.length === 0; });
      if (matches.length !== 1) out.push(`${path}: tipo de slide ou campos inválidos.`);
      return;
    }
    if (rule.enum && !rule.enum.includes(item)) out.push(`${path}: valor não permitido.`);
    if (rule.type === 'object') {
      if (!item || typeof item !== 'object' || Array.isArray(item)) { out.push(`${path}: use um objeto.`); return; }
      for (const key of rule.required ?? []) if (!Object.hasOwn(item, key)) out.push(`${path}.${key}: campo obrigatório.`);
      for (const [key, child] of Object.entries(item)) {
        if (Object.hasOwn(rule.properties, key)) visit(child, rule.properties[key], `${path}.${key}`, out);
        else if (rule.additionalProperties === false) out.push(`${path}.${key}: campo desconhecido.`);
      }
    } else if (rule.type === 'array') {
      if (!Array.isArray(item)) { out.push(`${path}: use uma lista.`); return; }
      if (item.length < rule.minItems || item.length > rule.maxItems) out.push(`${path}: quantidade de itens fora do limite.`);
      item.forEach((child, index) => visit(child, rule.items, `${path}[${index}]`, out));
    } else if (rule.type === 'string') {
      if (typeof item !== 'string' || !item.trim() || item.length < rule.minLength || item.length > rule.maxLength) out.push(`${path}: texto vazio, inválido ou longo demais.`);
      if (typeof item === 'string' && rule.pattern && !new RegExp(rule.pattern).test(item)) out.push(`${path}: caminho de imagem inválido.`);
    } else if (rule.type === 'integer' && (!Number.isInteger(item) || item < rule.minimum || item > rule.maximum)) out.push(`${path}: número inválido.`);
  }
  visit(value, schema, 'apresentação', errors);
  return errors;
}
