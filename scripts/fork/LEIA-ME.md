# Skins em modo livre: módulo CS2 (fork)

Este pacote traz um módulo CS2 do Auto Tournament com o **modo livre de skins**:

- Cada jogador escolhe **qualquer skin** do catálogo completo, sem precisar ganhar em drop.
- Ele define **float** (com botões Factory New … Battle-Scarred), **padrão (seed)**, **StatTrak** e **nametag**.
- Ele equipa no **CT, no T ou nos dois**.
- Ele escolhe um **agente** para cada lado.
- Tudo vai para o jogo pelo plugin de skins do Ready Up, igual às skins normais.

Drops, recompensas de torneio e trade-up continuam funcionando. O modo livre é um interruptor a mais em **Manage → Skins**.

## Antes de instalar

1. **A versão da plataforma precisa ser a mesma do módulo.** O arquivo `VERSION` diz a versão. Por exemplo, `3.0.0-beta.177.free.1` foi feito para a imagem `3.0.0-beta.177`. No `docker-compose.yml`, troque `:next` pela versão fixa:

   ```yaml
   image: sivertio/auto-tournament:3.0.0-beta.177
   ```

2. **Desligue a atualização automática de módulos.** Senão, uma imagem mais nova troca este módulo pelo oficial. No arquivo `.env` (o mesmo onde fica o `SESSION_SECRET`), adicione:

   ```
   MODULE_AUTO_UPDATE=false
   ```

3. Aplique as duas mudanças com:

   ```bash
   docker compose pull && docker compose up -d
   ```

## Instalar

Na máquina onde roda o container (a VPS do site, não a do servidor CS2), dentro da pasta extraída:

```bash
mkdir -p cs2-free && tar -xzf cs2-*.tar.gz -C cs2-free && cd cs2-free
bash install.sh auto-tournament
```

Importante: nunca rode `docker compose` dentro da pasta extraída. O compose fica na pasta original da plataforma, e rodar em outra pasta cria um segundo projeto com banco e dados vazios.

O `install.sh`:

1. guarda uma cópia do módulo CS2 atual em `/app/data/module-backups/cs2`;
2. instala este módulo;
3. reinicia o container;
4. confere se o modo livre respondeu.

Use o nome do seu container, se for diferente (veja com `docker ps`).

Depois, no site: **Manage → Skins**. Ligue **Skins** (no topo) e o **Modo livre**.

## Para aparecer dentro do jogo

As exigências são as mesmas das skins normais:

- **O plugin de skins do Ready Up precisa estar instalado no servidor CS2.** Instale com `bash install.sh skins` no servidor. Ele não vem no pacote Essentials.
- **O servidor precisa estar ligado à plataforma pelo modo fleet.** O csm precisa estar pareado.
- **Skins precisam estar ligadas para o servidor.** Isso vem da chave fleet com "Enable virtual skins", ou da tela do servidor.
- **O servidor não pode usar token Steam (GSLT).** A Valve bane o token de servidor que muda skins.

Quando o jogador muda algo no site:

- Se ele estiver no servidor, a mudança chega na próxima arma que receber.
- Agente e luvas mudam no próximo spawn.
- No warmup, o jogador pode digitar `.skins reload`.

## Voltar ao módulo oficial

```bash
bash install.sh auto-tournament --undo
```

O banco continua compatível com o módulo oficial. O modo livre só acrescenta uma coluna (`nametag`) e uma tabela (`cs2_player_agents`), e o oficial ignora as duas. Depois de voltar, você pode remover `MODULE_AUTO_UPDATE=false` e voltar para `:next`.

## Atualizar a plataforma no futuro

Este módulo só funciona com a versão para a qual foi feito. Para ir para uma versão nova do Auto Tournament:

1. O fork precisa ser atualizado para a nova versão, e um módulo novo precisa ser gerado com `scripts/fork/build-free-skins.sh`.
2. Só então troque a tag da imagem e rode o `install.sh` do pacote novo.

Se trocar a imagem antes, o módulo antigo pode não carregar. Nesse caso, use `--undo`.

## Observações

- As fotos dos agentes vêm do CDN da Steam, e as das skins vêm do próprio site.
- O risco de banimento pela Valve é o mesmo das skins normais. Use só em servidores onde você aceita esse risco.
