import type { Translation } from "../../format";
import type en from "../en/hurl";

export default {
  "hurl.format": "Hurl",
  "hurl.checks": "Comprobaciones ({count})",
  "hurl.passed": "{count, plural, one {# correcta} other {# correctas}}",
  "hurl.failed": "{failed} de {count} comprobaciones fallaron",
  "hurl.failedShort": "{failed} fallaron",
  "hurl.ok": "Correcta",
  "hurl.notOk": "Fallida",
  "hurl.check.missing": "no hay nada",
  "hurl.check.unsupported": "lines aún no puede comprobar {what}",
  "hurl.check.notJson": "el cuerpo no es JSON",
  "hurl.check.invalid": "lines no puede leer esto: {error}",
  "hurl.check.status": "HTTP {status}",
  "hurl.check.body": "El cuerpo",
  "hurl.check.capture": "Captura {name}",
  "hurl.check.had": "Tenía {value}",
} satisfies Translation<typeof en>;
