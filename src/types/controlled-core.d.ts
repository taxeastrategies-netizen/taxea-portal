/** Contracts for Taxea's server-mediated integrations, not direct Core calls. */
type JsonKind = 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';
export interface JsonSchema {
  type?: JsonKind | readonly JsonKind[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
  [keyword: string]: unknown;
}
type KindValue<S, K> = K extends JsonKind ? SchemaValue<Omit<S, 'type'> & {type: K}> : never;
type SchemaValue<S> = S extends {type: readonly (infer K)[]} ? KindValue<S, K>
  : S extends {type: 'null'} ? null
  : S extends { type: 'string' } ? string
  : S extends { type: 'number' | 'integer' } ? number
  : S extends { type: 'boolean' } ? boolean
  : S extends { type: 'array', items: infer Item } ? SchemaValue<Item>[]
  : S extends { properties: infer Props } ? { [K in keyof Props]?: SchemaValue<Props[K]> }
  : S extends { type: 'object' } ? Record<string, unknown>
  : unknown;
interface LimitedRequest {
  companyId?: string;
  company_id?: string;
  operation?: string;
}
interface LlmRequest extends LimitedRequest {
  prompt: string;
  file_urls?: string[];
  add_context_from_internet?: boolean;
  model?: string;
}
export interface ControlledCore {
  InvokeLLM<S extends JsonSchema>(params: LlmRequest & { response_json_schema: S }): Promise<SchemaValue<S>>;
  InvokeLLM(params: LlmRequest): Promise<string>;
  ExtractDataFromUploadedFile<S extends JsonSchema>(params: LimitedRequest & {file_url: string, json_schema: S}): Promise<{status: string, output?: SchemaValue<S>, details?: string}>;
  SendEmail(params: {operation: 'reminder', companyId: string, invoiceId: string} | {operation: 'tax_notice', companyId: string, documentId: string}): Promise<unknown>;
  SendEmail(params: LimitedRequest & {to: string, subject: string, body: string, from_name?: string, invoiceId?: string, documentId?: string}): Promise<unknown>;
}
