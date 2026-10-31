// GENERATED from documentStorage modules. Run node scripts/build-storage-runtime.mjs.
// canonical-sha256: c05cefc1a222d106b84215e160fcda55afa25f8dbc3b0a28d0fb3c0a7b87aac3
// base44/functions/documentStorage/storageCredentials.mjs
var encoder = new TextEncoder();
var STORAGE_PROJECT = "plasma-minutia-510419-c4";
var STORAGE_BUCKET = "taxea-portal-private-es-6a00fec5";
var STORAGE_ACCOUNT = `taxea-portal-storage@${STORAGE_PROJECT}.iam.gserviceaccount.com`;
function storageConfiguration(env) {
  const raw = env.get("TAXEA_GCS_CREDENTIALS_JSON");
  if (!raw) throw new Error("PRIVATE_STORAGE_NOT_CONFIGURED");
  let key;
  try {
    key = JSON.parse(raw);
  } catch {
    throw new Error("PRIVATE_STORAGE_INVALID_CONFIG");
  }
  if (key.type !== "service_account" || key.project_id !== STORAGE_PROJECT || key.client_email !== STORAGE_ACCOUNT || key.token_uri !== "https://oauth2.googleapis.com/token" || !/^-----BEGIN PRIVATE KEY-----/.test(key.private_key || "") || env.get("TAXEA_GCS_BUCKET") !== STORAGE_BUCKET || env.get("TAXEA_GCS_PROJECT_ID") !== STORAGE_PROJECT)
    throw new Error("PRIVATE_STORAGE_INVALID_CONFIG");
  return key;
}
function pemBytes(pem) {
  return Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "")), (c) => c.charCodeAt(0));
}
var base64 = (bytes) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.slice(i, i + 8192));
  return btoa(s);
};
var base64url = (bytes) => base64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
async function importStorageKey(config, extractable = false) {
  return crypto.subtle.importKey("pkcs8", pemBytes(config.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, extractable, ["sign"]);
}

// base44/functions/documentStorage/storageTransport.mjs
var encoder2 = new TextEncoder();
var sha256 = async (bytes) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) => b.toString(16).padStart(2, "0")).join("");
async function boundedBytes(response, max = 50 * 1024 * 1024) {
  if (Number(response.headers.get("content-length") || 0) > max) throw new Error("STORAGE_RESPONSE_TOO_LARGE");
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader(), parts = [];
  let size = 0;
  try {
    for (; ; ) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) throw new Error("STORAGE_RESPONSE_TOO_LARGE");
      parts.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {
    });
    throw error;
  } finally {
    reader.releaseLock();
  }
  const out = new Uint8Array(size);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}
async function boundedFetch(url, init, max, fetcher) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 25e3);
  try {
    const response = await fetcher(url, { ...init, redirect: "manual", signal: controller.signal });
    return { status: response.status, headers: response.headers, bytes: await boundedBytes(response, max) };
  } finally {
    clearTimeout(timer);
  }
}
async function storageTransport(env, fetcher = (...args) => globalThis.fetch(...args)) {
  const config = storageConfiguration(env), key = await importStorageKey(config), now = Math.floor(Date.now() / 1e3);
  const segment = (value) => base64url(encoder2.encode(JSON.stringify(value)));
  const payload = segment({ alg: "RS256", typ: "JWT" }) + "." + segment({ iss: STORAGE_ACCOUNT, scope: "https://www.googleapis.com/auth/devstorage.read_write", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 600 });
  const signature = base64url(new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, encoder2.encode(payload))));
  let tokenResponse;
  try {
    tokenResponse = await boundedFetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: payload + "." + signature }).toString() }, 16384, fetcher);
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    const kind = /illegal invocation|brand check|does not implement/.test(message) ? "BINDING" : /certificate|certificat|tls|ssl/.test(message) ? "TLS" : /dns|resolve|lookup/.test(message) ? "DNS" : /timed? ?out|abort/.test(message) ? "TIMEOUT" : /duplex|body|serializ/.test(message) ? "BODY" : /connect|network|fetch/.test(message) ? "CONNECT" : ["TypeError", "AbortError", "OperationError", "InvalidAccessError", "ReferenceError"].includes(error?.name) ? error.name : "Error";
    const failure = new Error("STORAGE_AUTH_NETWORK_" + kind);
    const words = /* @__PURE__ */ new Set(["illegal", "invocation", "headers", "signal", "abortsignal", "argument", "class", "constructor", "url", "required", "not", "supported", "fetch", "failed", "object", "function", "request", "response", "readable", "locked", "release", "valid", "invalid", "cannot", "value", "promise", "undefined", "type", "read", "properties", "data", "bytes", "array", "buffer", "cancel", "decoder", "length", "duplex", "controller", "clone", "getreader", "redirect"]);
    failure.storageHints = [...new Set(message.split(/\W+/).filter((word) => words.has(word)))].slice(0, 12);
    throw failure;
  }
  let token;
  try {
    token = JSON.parse(new TextDecoder().decode(tokenResponse.bytes));
  } catch {
    throw new Error("STORAGE_AUTH_NOT_JSON_" + tokenResponse.status);
  }
  if (tokenResponse.status !== 200 || typeof token.access_token !== "string" || token.token_type !== "Bearer") {
    const reason = ["invalid_grant", "invalid_client", "invalid_request", "invalid_scope", "unauthorized_client", "access_denied"].includes(token.error) ? token.error.toUpperCase() : "UNEXPECTED";
    throw new Error("STORAGE_AUTH_FAILED_" + tokenResponse.status + "_" + reason);
  }
  const auth = { Authorization: "Bearer " + token.access_token };
  const objectUrl = (name) => "https://storage.googleapis.com/storage/v1/b/" + STORAGE_BUCKET + "/o/" + encodeURIComponent(name);
  const validName = (name) => {
    if (typeof name !== "string" || name.length > 512 || !/^(__taxea_security_probe__|companies)\/[a-zA-Z0-9_/-]+(?:\.[a-zA-Z0-9]+)?$/.test(name) || name.includes("..")) throw new Error("STORAGE_INVALID_OBJECT");
    return name;
  };
  return {
    async put(name, bytes, mime = "application/octet-stream") {
      validName(name);
      if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > 50 * 1024 * 1024) throw new Error("STORAGE_INVALID_SIZE");
      if (!/^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]*$/i.test(mime)) throw new Error("STORAGE_INVALID_MIME");
      const disposition = /^(application\/pdf|image\/(jpeg|png|webp))$/.test(mime) ? "inline" : "attachment";
      const boundary = "taxea_" + crypto.randomUUID().replace(/-/g, "");
      const metadata = { name, contentType: mime, cacheControl: "private, no-store", contentDisposition: disposition };
      const body = new Blob(["--" + boundary + "\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n" + JSON.stringify(metadata) + "\r\n--" + boundary + "\r\nContent-Type: " + mime + "\r\n\r\n", bytes, "\r\n--" + boundary + "--\r\n"]);
      const url = "https://storage.googleapis.com/upload/storage/v1/b/" + STORAGE_BUCKET + "/o?uploadType=multipart&ifGenerationMatch=0";
      const r = await boundedFetch(url, { method: "POST", headers: { ...auth, "Content-Type": "multipart/related; boundary=" + boundary }, body }, 32768, fetcher);
      if (r.status !== 200) throw new Error("STORAGE_UPLOAD_FAILED_" + r.status);
      const meta = JSON.parse(new TextDecoder().decode(r.bytes));
      if (meta.name !== name || meta.bucket !== STORAGE_BUCKET || Number(meta.size) !== bytes.length || !/^\d+$/.test(meta.generation)) throw new Error("STORAGE_UPLOAD_UNVERIFIED");
      if (meta.cacheControl !== "private, no-store" || meta.contentDisposition !== disposition) throw new Error("STORAGE_METADATA_UNVERIFIED");
      return { name, generation: meta.generation, size: Number(meta.size), contentType: meta.contentType };
    },
    async get(name, generation) {
      validName(name);
      if (!/^\d+$/.test(generation)) throw new Error("STORAGE_INVALID_GENERATION");
      const r = await boundedFetch(objectUrl(name) + "?alt=media&generation=" + generation, { headers: auth }, 50 * 1024 * 1024, fetcher);
      if (r.status !== 200) throw new Error("STORAGE_DOWNLOAD_FAILED_" + r.status);
      return r.bytes;
    },
    async remove(name, generation) {
      validName(name);
      if (!/^\d+$/.test(generation)) throw new Error("STORAGE_INVALID_GENERATION");
      const r = await boundedFetch(objectUrl(name) + "?ifGenerationMatch=" + generation, { method: "DELETE", headers: auth }, 8192, fetcher);
      if (r.status !== 204) throw new Error("STORAGE_CLEANUP_FAILED");
      return true;
    },
    async unsignedStatus(name) {
      validName(name);
      const r = await boundedFetch(objectUrl(name) + "?alt=media", {}, 4096, fetcher);
      return r.status;
    }
  };
}

// base44/functions/documentStorage/storageSigning.mjs
var encode = (value) => encodeURIComponent(value).replace(/[!'()*]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
async function signedStorageRead(env, asset, now = /* @__PURE__ */ new Date()) {
  if (!asset || !/^companies\/[A-Za-z0-9_-]{1,128}\/[a-f0-9-]{36}\.[a-z0-9]{1,8}$/.test(asset.object_name || "") || !/^\d+$/.test(asset.generation || "")) throw new Error("STORAGE_INVALID_ASSET");
  const timestamp = now.toISOString().replace(/[-:]|\.\d{3}/g, ""), day = timestamp.slice(0, 8), scope = day + "/auto/storage/goog4_request";
  const path = "/" + STORAGE_BUCKET + "/" + asset.object_name.split("/").map(encode).join("/");
  const query = { "X-Goog-Algorithm": "GOOG4-RSA-SHA256", "X-Goog-Credential": STORAGE_ACCOUNT + "/" + scope, "X-Goog-Date": timestamp, "X-Goog-Expires": "120", "X-Goog-SignedHeaders": "host", generation: asset.generation, "response-cache-control": "private, no-store" };
  const canonicalQuery = Object.entries(query).map(([k, v]) => [encode(k), encode(v)]).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => k + "=" + v).join("&");
  const canonical = ["GET", path, canonicalQuery, "host:storage.googleapis.com\n", "host", "UNSIGNED-PAYLOAD"].join("\n");
  const toSign = ["GOOG4-RSA-SHA256", timestamp, scope, await sha256(new TextEncoder().encode(canonical))].join("\n");
  const key = await importStorageKey(storageConfiguration(env));
  const signature = Array.from(new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(toSign))), (b) => b.toString(16).padStart(2, "0")).join("");
  return { url: "https://storage.googleapis.com" + path + "?" + canonicalQuery + "&X-Goog-Signature=" + signature, expiresAt: new Date(now.getTime() + 12e4).toISOString() };
}

// base44/functions/documentStorage/storageAssets.mjs
var norm = (value) => String(value || "").trim().toLowerCase();
var isStorageAdmin = (user) => ["admin", "super_admin"].includes(user?.role);
var storageAccountEnabled = (user) => !!user?.id && ![user, user.data].filter(Boolean).some((state) => state.is_deleted === true || ["eliminado", "bloqueado", "suspendido"].includes(norm(state.status)) || ["disabled", "deleted", "blocked", "suspended"].includes(norm(state.accountAccessStatus)));
var storageEnabled = (company, env) => company?.private_document_storage_enabled === true || env?.get?.("TAXEA_PRIVATE_STORAGE_ENFORCED") === "true";
function mayAccessStorageCompany(user, company) {
  if (!storageAccountEnabled(user) || !company || company.activa === false) return false;
  if (isStorageAdmin(user)) return true;
  const email = norm(user.email);
  return !!email && (norm(company.owner_email) === email || Array.isArray(company.usuarios_autorizados) && company.usuarios_autorizados.some((value) => norm(value) === email));
}
var assetReference = (id) => "https://taxeaportal.com/private-document/" + encodeURIComponent(id);
function assetIdFromReference(value) {
  if (typeof value !== "string") return "";
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || u.hostname !== "taxeaportal.com" || u.port || u.username || u.password || u.search || u.hash) return "";
    const m = u.pathname.match(/^\/private-document\/([A-Za-z0-9_-]{1,128})$/);
    return m?.[1] || "";
  } catch {
    return "";
  }
}
function privateFileFormat(file, bytes) {
  const ext = String(file.name || "").split(".").pop().toLowerCase();
  const text = new TextDecoder().decode(bytes.slice(0, 12));
  if (ext === "pdf" && text.startsWith("%PDF-")) return { ext, mime: "application/pdf" };
  if (["jpg", "jpeg"].includes(ext) && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { ext: "jpg", mime: "image/jpeg" };
  if (ext === "png" && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) return { ext, mime: "image/png" };
  if (ext === "webp" && text.startsWith("RIFF") && text.slice(8) === "WEBP") return { ext, mime: "image/webp" };
  if (ext === "gif" && /^GIF8[79]a/.test(text)) return { ext, mime: "image/gif" };
  if (ext === "bmp" && bytes[0] === 66 && bytes[1] === 77) return { ext, mime: "image/bmp" };
  if (ext === "zip" && bytes[0] === 80 && bytes[1] === 75 && (bytes[2] === 3 && bytes[3] === 4 || bytes[2] === 5 && bytes[3] === 6)) return { ext, mime: "application/zip" };
  if (["xlsx", "docx", "pptx"].includes(ext) && bytes[0] === 80 && bytes[1] === 75 && bytes[2] === 3 && bytes[3] === 4) return { ext, mime: { xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }[ext] };
  if (["txt", "csv", "json", "xml"].includes(ext) && (!bytes.slice(0, 8192).includes(0) || (bytes[0] === 255 && bytes[1] === 254 || bytes[0] === 254 && bytes[1] === 255))) return { ext, mime: "application/octet-stream" };
  if (["xls", "doc", "ppt"].includes(ext) && [208, 207, 17, 224, 161, 177, 26, 225].every((v, i) => bytes[i] === v)) return { ext, mime: "application/octet-stream" };
  throw new Error("STORAGE_UNSUPPORTED_FILE");
}
async function storageCompany(svc, user, id) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id || "")) return null;
  const company = await svc.entities.Company.get(id).catch(() => null);
  return mayAccessStorageCompany(user, company) ? company : null;
}
async function savePrivateAsset(svc, user, company, file, env, fetcher) {
  if (!mayAccessStorageCompany(user, company) || !storageEnabled(company, env)) throw new Error("STORAGE_COMPANY_NOT_ENABLED");
  if (!file?.size || file.size > 25 * 1024 * 1024) throw new Error("STORAGE_INVALID_SIZE");
  const bytes = new Uint8Array(await file.arrayBuffer()), format = privateFileFormat(file, bytes), digest = await sha256(bytes);
  const previous = await svc.entities.DocumentAsset.filter({ company_id: company.id, sha256: digest, status: "ready" }, "-created_date", 1);
  if (previous[0]) return { asset: previous[0], file_url: assetReference(previous[0].id), reused: true };
  const objectName = "companies/" + company.id + "/" + crypto.randomUUID() + "." + format.ext;
  const pending = await svc.entities.DocumentAsset.create({ company_id: company.id, object_name: objectName, generation: "", sha256: digest, size: bytes.length, mime_type: format.mime, original_name: String(file.name || "documento").replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 240), status: "uploading", uploaded_by: String(user.id), storage_provider: "gcs" });
  let object, bytesVerified = false;
  try {
    const transport = await storageTransport(env, fetcher);
    object = await transport.put(objectName, bytes, format.mime);
    await svc.entities.DocumentAsset.update(pending.id, { generation: object.generation });
    const read = await transport.get(objectName, object.generation);
    if (await sha256(read) !== digest) throw new Error("STORAGE_HASH_MISMATCH");
    bytesVerified = true;
    await svc.entities.DocumentAsset.update(pending.id, { status: "ready", verified_at: (/* @__PURE__ */ new Date()).toISOString(), error_code: "" });
    const asset = await svc.entities.DocumentAsset.get(pending.id);
    if (asset.status !== "ready" || asset.sha256 !== digest || asset.generation !== object.generation || asset.company_id !== company.id) throw new Error("STORAGE_ASSET_UNVERIFIED");
    return { asset, file_url: assetReference(asset.id), reused: false };
  } catch (error) {
    if (bytesVerified) {
      const recovered = await svc.entities.DocumentAsset.get(pending.id).catch(() => null);
      if (recovered?.status === "ready" && recovered.sha256 === digest && recovered.generation === object?.generation && recovered.company_id === company.id) return { asset: recovered, file_url: assetReference(recovered.id), reused: true };
    } else {
      const code = /^STORAGE_[A-Z_0-9]+$/.test(error?.message || "") ? error.message : "STORAGE_UPLOAD_INTERRUPTED";
      await svc.entities.DocumentAsset.update(pending.id, { status: "failed", generation: object?.generation || "", error_code: code }).catch(() => {
      });
    }
    throw error;
  }
}
async function authorizedAsset(svc, user, id) {
  if (!storageAccountEnabled(user) || !/^[A-Za-z0-9_-]{1,128}$/.test(id || "")) return null;
  const asset = await svc.entities.DocumentAsset.get(id).catch(() => null);
  if (!asset || asset.status !== "ready" || !asset.object_name?.startsWith("companies/" + asset.company_id + "/")) return null;
  if (asset.company_id === "__admin_staging__") return isStorageAdmin(user) ? asset : null;
  const company = await svc.entities.Company.get(asset.company_id).catch(() => null);
  if (!company) return null;
  return isStorageAdmin(user) || mayAccessStorageCompany(user, company) ? asset : null;
}
async function readPrivateAssetBytes(svc, user, reference, env, companyId) {
  const asset = await authorizedAsset(svc, user, assetIdFromReference(reference));
  if (!asset || companyId && asset.company_id !== companyId) throw new Error("STORAGE_ASSET_FORBIDDEN");
  return readVerifiedAssetBytes(asset, env);
}
async function readVerifiedAssetBytes(asset, env) {
  const transport = await storageTransport(env), bytes = await transport.get(asset.object_name, asset.generation);
  if (bytes.length !== asset.size || await sha256(bytes) !== asset.sha256) throw new Error("STORAGE_HASH_MISMATCH");
  return { asset, bytes };
}
var invoicePdfReference = (invoice) => invoice?.qr_url && invoice.tipo === "emitida" ? invoice.qr_pdf_url : invoice?.archivo_url;
function publicInvoiceCapabilityValid(invoice, token, now = Date.now()) {
  if (!invoice || invoice.anulada || invoice.public_token_revoked_at || !/^[A-Za-z0-9_-]{1,128}$/.test(String(invoice.company_id || ""))) return false;
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token) || typeof invoice.public_token !== "string" || invoice.public_token.length !== 64) return false;
  let difference = 0;
  for (let i = 0; i < 64; i++) difference |= token.charCodeAt(i) ^ invoice.public_token.charCodeAt(i);
  if (difference) return false;
  if (invoice.public_token_expires_at) {
    const expiry = Date.parse(invoice.public_token_expires_at);
    if (!Number.isFinite(expiry) || expiry <= now) return false;
  }
  return true;
}
async function readPublicInvoicePdf(svc, invoice, token, env) {
  if (!publicInvoiceCapabilityValid(invoice, token)) throw new Error("STORAGE_PUBLIC_CAPABILITY_INVALID");
  const company = await svc.entities.Company.get(invoice.company_id).catch(() => null);
  if (!company || company.activa === false) throw new Error("STORAGE_PUBLIC_CAPABILITY_INVALID");
  const id = assetIdFromReference(invoicePdfReference(invoice));
  const asset = id ? await svc.entities.DocumentAsset.get(id).catch(() => null) : null;
  if (!asset || asset.status !== "ready" || asset.company_id !== invoice.company_id || !asset.object_name?.startsWith("companies/" + invoice.company_id + "/")) throw new Error("STORAGE_ASSET_FORBIDDEN");
  if (asset.mime_type !== "application/pdf" || !Number.isSafeInteger(asset.size) || asset.size <= 0 || asset.size > 25 * 1024 * 1024) throw new Error("STORAGE_INVALID_PUBLIC_PDF");
  const result = await readVerifiedAssetBytes(asset, env);
  if (new TextDecoder().decode(result.bytes.slice(0, 5)) !== "%PDF-") throw new Error("STORAGE_INVALID_PUBLIC_PDF");
  return result;
}
async function resolvePrivateAsset(svc, user, id, env) {
  const asset = await authorizedAsset(svc, user, id);
  if (!asset) return null;
  return { ...await signedStorageRead(env, asset), mimeType: asset.mime_type, name: asset.original_name, size: asset.size, sha256: asset.sha256 };
}
export {
  assetIdFromReference,
  assetReference,
  authorizedAsset,
  invoicePdfReference,
  isStorageAdmin,
  mayAccessStorageCompany,
  privateFileFormat,
  publicInvoiceCapabilityValid,
  readPrivateAssetBytes,
  readPublicInvoicePdf,
  resolvePrivateAsset,
  savePrivateAsset,
  storageAccountEnabled,
  storageCompany,
  storageEnabled
};
