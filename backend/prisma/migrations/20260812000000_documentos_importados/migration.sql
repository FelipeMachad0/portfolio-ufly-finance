-- Fila de documentos enviados para leitura automática.
--
-- O usuário envia um lote de documentos, continua trabalhando e volta quando as
-- leituras estiverem prontas, em vez de ficar preso numa tela esperando.
--
-- Persistir em tabela (e não em memória) é o que faz a leitura sobreviver a um
-- restart do backend: ao subir, o processo em segundo plano retoma o
-- acompanhamento das linhas que ainda não terminaram.
--
-- ON DELETE CASCADE aqui é PROPOSITAL, e contrário à regra das outras tabelas
-- (ver 20260807000000_lancamentos_independem_do_usuario). A diferença é o que a
-- linha representa: um lançamento é dado da empresa e sobrevive à saída da
-- pessoa; uma leitura pendente é rascunho pessoal, sem valor contábil, e não faz
-- sentido sobrar órfã para alguém que nunca viu o documento confirmar. O
-- lançamento criado na confirmação segue as regras normais e não é afetado.

CREATE TABLE documentos_importados (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID         NOT NULL,
    arquivo_id          VARCHAR(100) NOT NULL,
    nome_original       VARCHAR(255) NOT NULL,
    mimetype            VARCHAR(100) NOT NULL,
    tamanho             INTEGER      NOT NULL,
    status              VARCHAR(20)  NOT NULL DEFAULT 'na_fila',
    resultado           JSONB,
    erro                VARCHAR(500),
    transaction_id      UUID,
    criado_em           TIMESTAMP(6) NOT NULL DEFAULT now(),
    atualizado_em       TIMESTAMP(6) NOT NULL DEFAULT now(),
    iniciado_em         TIMESTAMP(6),

    CONSTRAINT documentos_importados_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE NO ACTION,

    -- O lançamento criado na confirmação não é apagado junto: se ele for
    -- removido, a linha aqui só perde a referência.
    CONSTRAINT documentos_importados_transaction_id_fkey
        FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL ON UPDATE NO ACTION,

    -- Estados possíveis, no banco: um status escrito errado deixaria a linha
    -- invisível para o processo em segundo plano e para a bandeja do usuário.
    CONSTRAINT documentos_importados_status_check
        CHECK (status IN ('na_fila', 'lendo', 'pronta', 'falhou', 'confirmada', 'descartada'))
);

-- A bandeja do usuário: as leituras dele, por status.
CREATE INDEX idx_documentos_importados_user_status ON documentos_importados (user_id, status);

-- O processo em segundo plano: quem ainda precisa de atenção, de qualquer usuário.
CREATE INDEX idx_documentos_importados_status ON documentos_importados (status);
