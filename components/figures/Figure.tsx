import Shell from "../hero/Shell";
import Vault from "./Vault";
import LedgerFig from "./Ledger";

/* Picks the interface fragment that stands for a project. */
export default function Figure({ kind }: { kind: "shell" | "vault" | "ledger" }) {
  if (kind === "shell") return <Shell />;
  if (kind === "vault") return <Vault />;
  return <LedgerFig />;
}
