/** Make optional object requirements explicit without changing tool semantics. */
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)

function normalizeObjectSchemas(root) {
  const pending = [root]
  let changed = 0
  while (pending.length) {
    const schema = pending.pop()
    if (!record(schema)) continue
    if (schema.type === 'object' || Array.isArray(schema.type) && schema.type.includes('object') || record(schema.properties)) {
      if (!Object.hasOwn(schema, 'required')) {
        schema.required = []
        changed++
      }
    }
    // Only walk schema-bearing keywords. Defaults, examples, const values and
    // arbitrary user data can contain properties named "type" or "required".
    for (const key of ['properties', 'patternProperties', '$defs', 'definitions', 'dependentSchemas']) {
      if (record(schema[key])) pending.push(...Object.values(schema[key]))
    }
    for (const key of ['allOf', 'anyOf', 'oneOf', 'prefixItems']) {
      if (Array.isArray(schema[key])) pending.push(...schema[key])
    }
    for (const key of ['items', 'additionalProperties', 'additionalItems', 'unevaluatedProperties', 'unevaluatedItems', 'contains', 'propertyNames', 'not', 'if', 'then', 'else']) {
      if (Array.isArray(schema[key])) pending.push(...schema[key])
      else if (record(schema[key])) pending.push(schema[key])
    }
  }
  return changed
}

/** Normalize only serialized tool schemas; preserve the request otherwise. */
export function normalizeToolSchemas(body) {
  if (typeof body !== 'string') return { body, changed: 0 }
  let payload
  try { payload = JSON.parse(body) } catch { return { body, changed: 0 } }
  if (!record(payload) || !Array.isArray(payload.tools)) return { body, changed: 0 }
  let changed = 0
  for (const tool of payload.tools) {
    if (!record(tool)) continue
    if (tool.type === 'function') changed += normalizeObjectSchemas(tool.function?.parameters ?? tool.parameters)
    else if (record(tool.input_schema)) changed += normalizeObjectSchemas(tool.input_schema)
  }
  return { body: changed ? JSON.stringify(payload) : body, changed }
}
