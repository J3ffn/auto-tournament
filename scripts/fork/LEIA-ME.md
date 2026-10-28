# Skins em modo livre: módulo CS2 (fork)

Este pacote traz um módulo CS2 do Auto Tournament com o **modo livre de skins**:

- Cada jogador escolhe **qualquer skin** do catálogo completo, sem precisar ganhar em drop.
- Ele define **float** (com botões Factory New … Battle-Scarred), **padrão (seed)**, **StatTrak** e **nametag**.
- Ele equipa no **CT, no T ou nos dois**.
- Ele escolhe um **agente** para cada lado.
- Tudo vai para o jogo pelo plugin de skins do Ready Up, igual às skins normais.
- O inventário tem duas abas, **Meus itens** e **Loadout**, inspiradas na tela de loadout do CS2:
  - **Loadout**: o lado CT à esquerda e o TR à direita, com o lado em edição destacado na cor do jogo. As armas mudam de lugar arrastando (ou clicando na arma e depois no slot). Ao clicar num slot aparecem as skins dele: as do inventário e o **Catálogo**, que adiciona e equipa na hora.
  - **Meus itens**: filtros por lado (CT/TR), tipo e nome; o painel da skin mostra onde ela está equipada (CT/TR), personalização, perfil e remover, com "Desfazer".
  - **Adicionar skins**: marque várias e adicione de uma vez (Nova de fábrica, uma de cada).
  - **Loadouts salvos** (por exemplo "Azul" e "Vermelho"): troque entre eles pelo menu; o que está em uso é o que vai para o jogo.
  - O perfil mostra o loadout, e o dono pode esconder.
- As telas se adaptam a telas grandes, médias (1200×750, 800×600) e ao celular.

Drops, recompensas de torneio e trade-up continuam funcionando. O modo livre é um interruptor a mais em **Manage → Skins**.

## Antes de instalar

1. **A versão da plataforma precisa ser a mesma do módulo.** O arquivo `VERSION` diz a versão. Por exemplo, `3.0.0-beta.232.free.1` foi feito para a imagem `3.0.0-beta.232`. No `docker-compose.yml`, troque `:next` (ou a versão antiga) pela versão fixa:

   ```yaml
   image: sivertio/auto-tournament:3.0.0-beta.232
   ```

   O `install.sh` confere isso e não instala se a imagem for outra.

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

1. guarda uma cópia do módulo CS2 oficial em `/app/data/module-backups/cs2-<versão>`;
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

Ele volta o módulo oficial da versão da imagem que está rodando. O banco continua compatível com o módulo oficial. O modo livre só acrescenta uma coluna (`nametag`) e três tabelas (`cs2_player_agents`, `cs2_player_saved_loadouts` e `cs2_player_skin_prefs`), e o oficial ignora todas. Depois de voltar, você pode remover `MODULE_AUTO_UPDATE=false` e voltar para `:next`.

## Atualizar a plataforma (por exemplo, de 216 para 232)

Cada módulo só funciona com a versão para a qual foi feito. Para trocar de versão, use o pacote novo, gerado do fork já atualizado. Na pasta original da plataforma (a do `docker-compose.yml`):

1. No `docker-compose.yml`, troque a tag da imagem pela nova (`3.0.0-beta.232`).
2. No `.env`, troque temporariamente `MODULE_AUTO_UPDATE=false` por `MODULE_AUTO_UPDATE=true`. Assim a plataforma troca o módulo antigo pelo **oficial** da versão nova e roda as migrações dele.
3. Rode `docker compose pull && docker compose up -d` e espere o site voltar. Em **Manage → Modules**, o CS2 deve estar na versão nova.
4. Volte o `.env` para `MODULE_AUTO_UPDATE=false` e rode `docker compose up -d` de novo.
5. Rode o `install.sh` do pacote novo. Ele guarda uma cópia do módulo oficial novo (para o `--undo`) e instala o modo livre.

As skins, nametags e agentes escolhidos ficam no banco, por isso continuam lá depois da troca.

Se você pular os passos 2 a 4, a instalação ainda funciona, mas o `--undo` não terá o módulo oficial da versão nova para voltar.

## Observações

- As fotos dos agentes vêm do CDN da Steam, e as das skins vêm do próprio site.
- O risco de banimento pela Valve é o mesmo das skins normais. Use só em servidores onde você aceita esse risco.
