import { Collection } from "discord.js";
import { abrirPacoteCommand } from "./commands/abrirPacote.js";
import { carreiraCommand } from "./commands/carreira.js";
import { carteiraCommand } from "./commands/carteira.js";
import { classificacaoCommand } from "./commands/classificacao.js";
import { colecaoCommand } from "./commands/colecao.js";
import { contratoCommand } from "./commands/contrato.js";
import { criarPerfilCommand } from "./commands/criarPerfil.js";
import { duelodesafiarCommand } from "./commands/duelodesafiar.js";
import { duelorespondCommand } from "./commands/duelorespond.js";
import { duelosCommand } from "./commands/duelos.js";
import { entrevistaCommand } from "./commands/entrevista.js";
import { jogarCarreiraCommand } from "./commands/jogarCarreira.js";
import { noticiasCommand } from "./commands/noticias.js";
import { pacotesCommand } from "./commands/pacotes.js";
import { personalizarCommand } from "./commands/personalizar.js";
import { pingCommand } from "./commands/ping.js";
import { propostasCommand } from "./commands/propostas.js";
import { rankingCommand } from "./commands/ranking.js";
import { recordesCommand } from "./commands/recordes.js";
import { rivalidadeCommand } from "./commands/rivalidade.js";
import { simularAmistosoCommand } from "./commands/simularAmistoso.js";
import { transferirCommand } from "./commands/transferir.js";
import { treinadorCommand } from "./commands/treinador.js";
import { treinarCommand } from "./commands/treinar.js";
import type { Command } from "./commands/types.js";

/**
 * Every slash command the bot knows about. Register a new command by adding
 * it here — commandRegistry is the single source of truth used both for
 * runtime dispatch (client.ts) and for registration with Discord
 * (deployCommands.ts), so the two can never drift apart.
 */
export function buildCommandRegistry(): Collection<string, Command> {
  const commands = new Collection<string, Command>();

  for (const command of [
    pingCommand,
    criarPerfilCommand,
    personalizarCommand,
    simularAmistosoCommand,
    carreiraCommand,
    treinarCommand,
    jogarCarreiraCommand,
    classificacaoCommand,
    carteiraCommand,
    contratoCommand,
    propostasCommand,
    transferirCommand,
    pacotesCommand,
    abrirPacoteCommand,
    colecaoCommand,
    duelodesafiarCommand,
    duelorespondCommand,
    duelosCommand,
    rankingCommand,
    recordesCommand,
    rivalidadeCommand,
    noticiasCommand,
    treinadorCommand,
    entrevistaCommand,
  ]) {
    commands.set(command.data.name, command);
  }

  return commands;
}
