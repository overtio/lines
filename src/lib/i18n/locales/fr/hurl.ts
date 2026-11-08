import type { Translation } from "../../format";
import type en from "../en/hurl";

export default {
  "hurl.format": "Hurl",
  "hurl.checks": "Vérifications ({count})",
  "hurl.passed": "{count, plural, one {# réussie} other {# réussies}}",
  "hurl.failed": "{failed} vérifications sur {count} ont échoué",
  "hurl.failedShort": "{failed} en échec",
  "hurl.ok": "Réussie",
  "hurl.notOk": "Échouée",
  "hurl.check.missing": "rien",
  "hurl.check.unsupported": "lines ne peut pas encore vérifier {what}",
  "hurl.check.notJson": "le corps n’est pas du JSON",
  "hurl.check.invalid": "lines ne peut pas lire ceci : {error}",
  "hurl.check.status": "HTTP {status}",
  "hurl.check.body": "Le corps",
  "hurl.check.capture": "Capture {name}",
  "hurl.check.had": "Avait {value}",
} satisfies Translation<typeof en>;
