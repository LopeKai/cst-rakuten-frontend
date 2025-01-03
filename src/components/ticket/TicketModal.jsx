// src/components/ticket/TicketModal.js
import React, { useMemo, useState, useRef } from "react";
import _ from "lodash";
import { motion } from "framer-motion";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  ModalBody,
  ModalFooter,
  Flex,
  Box,
  HStack,
  Button,
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogBody,
  AlertDialogFooter,
  useToast,
} from "@chakra-ui/react";
import { Formik, Form } from "formik";
import * as Yup from "yup";

import { useBaseOmie } from "../../contexts/BaseOmieContext";
import { useEtapa } from "../../contexts/EtapaContext";
import { useTicket } from "../../contexts/TicketContext";
import { prestadorInitValues } from "../../initValues/prestadorInitValues";
import { servicoInitValues } from "../../initValues/servicoInitValues";
import { salvarPrestador } from "../../services/prestadorService";
import { salvarServico } from "../../services/servicoService";
import { prestadorValidationSchema } from "../../validation/prestadorValidationSchema";
import { servicoValidationSchema } from "../../validation/servicoValidationSchema";
import { ticketValidationSchema } from "../../validation/ticketValidationSchema";
import PrestadorForm from "../form/PrestadorForm";
import ServicoForm from "../form/ServicoForm";
import TicketActions from "./TicketActions";
import TicketFields from "./TicketFields";
import TicketStatusButtons from "./TicketStatusButtons";

import { FilesViewComponent } from "./FilesViewComponent";
import { ImportFilesComponent } from "./ImportFilesComponent";

const MotionModalContent = motion(ModalContent);

const TicketModal = ({ isOpen, closeModal, ticket = null }) => {
  const isEditMode = Boolean(ticket);
  const { salvarTicket } = useTicket();
  const { baseOmie } = useBaseOmie();
  const { listaEtapas } = useEtapa();
  const toast = useToast();

  // Estados para controlar a exibição dos formulários
  const [mostrarPrestador, setMostrarPrestador] = useState(
    ticket?.prestador ? true : false
  );
  const [mostrarServico, setMostrarServico] = useState(
    ticket?.servicos.length > 0 ? true : false
  );

  // Estados para controlar os diálogos de confirmação
  const [confirmacao, setConfirmacao] = useState({
    fecharModal: false,
    removerPrestador: false,
    removerServico: false,
  });

  // Referências para os AlertDialogs
  const cancelRefFechar = useRef();
  const cancelRefRemoverPrestador = useRef();
  const cancelRefRemoverServico = useRef();

  // Esquema de validação combinado
  const combinedValidationSchema = useMemo(() => {
    let schema = ticketValidationSchema;

    if (mostrarPrestador) {
      schema = schema.shape({
        prestador: prestadorValidationSchema,
      });
    } else {
      schema = schema.shape({
        prestador: Yup.object().nullable(),
      });
    }

    if (mostrarServico) {
      schema = schema.shape({
        servicos: Yup.array()
          .of(servicoValidationSchema)
          .min(1, "É necessário adicionar pelo menos um serviço"),
      });
    } else {
      schema = schema.shape({
        servicos: Yup.array().of(Yup.object().nullable()),
      });
    }

    return schema;
  }, [mostrarPrestador, mostrarServico]);

  // Valores iniciais combinados
  const combinedInitValues = useMemo(() => {
    let initValues = {
      titulo: "",
      observacao: "",
      prestador: prestadorInitValues,
      servicos: [],
      arquivos: [],
    };

    if (ticket) {
      initValues = {
        ...initValues,
        titulo: ticket.titulo,
        arquivos: ticket.arquivos,
        observacao: ticket.observacao,
        prestador: ticket.prestador || prestadorInitValues,
        servicos: ticket.servicos
          ? ticket.servicos.map((servico) => ({
              ...servicoInitValues,
              ...servico,
            }))
          : [],
      };
    }

    return initValues;
  }, [ticket]);

  // Handler de submissão
  const handleSubmit = async (values, { setSubmitting }) => {
    console.log("entrou");
    setSubmitting(true);
    try {
      let prestadorId = null;
      let servicosIds = [];

      if (mostrarPrestador && values.prestador) {
        const documentoLimpo = values.prestador.documento
          ? values.prestador.documento.replace(/[^\d]/g, "")
          : "";

        const cepLimpo = values.prestador.endereco.cep
          ? values.prestador.endereco.cep.replace(/[^\d]/g, "")
          : "";

        const prestadorDados = {
          ...values.prestador,
          documento: documentoLimpo,
          endereco: {
            ...values.prestador.endereco,
            cep: cepLimpo,
          },
        };

        if (prestadorDados.endereco && prestadorDados.endereco.bairro) {
          delete prestadorDados.endereco.bairro;
        }

        if (isEditMode && ticket.prestador) {
          prestadorId = ticket.prestador._id;
          const prestadorResponse = await salvarPrestador({
            ...prestadorDados,
            _id: prestadorId,
          });
          prestadorId = prestadorResponse.prestador._id;
        } else {
          const prestadorResponse = await salvarPrestador(prestadorDados);
          prestadorId = prestadorResponse.prestador._id;
        }
      }

      if (mostrarServico && values.servicos.length > 0) {
        for (let i = 0; i < values.servicos.length; i++) {
          const servico = values.servicos[i];
          if (servico) {
            let servicoId = null;
            if (isEditMode && ticket.servicos && ticket.servicos[i]) {
              servicoId = ticket.servicos[i]._id;
              const servicoResponse = await salvarServico({
                ...servico,
                _id: servicoId,
              });
              servicoId = servicoResponse.servico._id;
            } else {
              const servicoResponse = await salvarServico(servico);
              servicoId = servicoResponse.servico._id;
            }
            servicosIds.push(servicoId);
          }
        }
      }

      const ticketData = isEditMode
        ? {
            _id: ticket._id,
            titulo: values.titulo,
            observacao: values.observacao,
            status: values.status,
            prestadorId,
            servicosIds,
          }
        : {
            baseOmieId: baseOmie?._id,
            etapa: listaEtapas[0]?.codigo || "",
            titulo: values.titulo,
            observacao: values.observacao,
            status: "aguardando-inicio",
            prestadorId,
            servicosIds,
          };

      const sucessoTicket = await salvarTicket(ticketData);

      if (sucessoTicket.ticket?._id) {
        closeModal();
        toast({
          title: "Ticket salvo com sucesso.",
          status: "success",
          duration: 5000,
          isClosable: true,
        });
      } else {
        throw new Error("Erro ao salvar ticket.");
      }
    } catch (error) {
      console.error("Erro ao salvar ticket:", error);

      toast({
        title: "Erro ao salvar ticket.",
        description: error.message || "Ocorreu um erro inesperado.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Funções para abrir os diálogos de confirmação
  const abrirConfirmarFechar = (formik) => {
    const formAlterado =
      formik.values.titulo !== formik.initialValues.titulo ||
      formik.values.observacao !== formik.initialValues.observacao ||
      verificarAlteracoesPrestador(
        formik.values.prestador,
        formik.initialValues.prestador
      ) ||
      verificarAlteracoesServicos(
        formik.values.servicos,
        formik.initialValues.servicos
      );

    if (formAlterado) {
      setConfirmacao((prev) => ({ ...prev, fecharModal: true }));
    } else {
      confirmarFechar();
    }
  };

  const verificarAlteracoesPrestador = (prestadorAtual, prestadorInicial) => {
    return (
      prestadorAtual.nome !== prestadorInicial.nome ||
      prestadorAtual.tipo !== prestadorInicial.tipo ||
      prestadorAtual.documento !== prestadorInicial.documento ||
      prestadorAtual.email !== prestadorInicial.email ||
      prestadorAtual.comentariosRevisao !==
        prestadorInicial.comentariosRevisao ||
      prestadorAtual.status !== prestadorInicial.status ||
      // Verificação dos campos de pessoa física
      verificarAlteracoesPessoaFisica(
        prestadorAtual.pessoaFisica,
        prestadorInicial.pessoaFisica
      ) ||
      // Verificação dos dados bancários
      verificarAlteracoesDadosBancarios(
        prestadorAtual.dadosBancarios,
        prestadorInicial.dadosBancarios
      ) ||
      // Verificação do endereço
      verificarAlteracoesEndereco(
        prestadorAtual.endereco,
        prestadorInicial.endereco
      )
    );
  };

  const verificarAlteracoesPessoaFisica = (
    pessoaFisicaAtual,
    pessoaFisicaInicial
  ) => {
    if (!pessoaFisicaAtual || !pessoaFisicaInicial) return false;
    return (
      pessoaFisicaAtual.rg.numero !== pessoaFisicaInicial.rg.numero ||
      pessoaFisicaAtual.rg.orgaoEmissor !==
        pessoaFisicaInicial.rg.orgaoEmissor ||
      pessoaFisicaAtual.dataNascimento !== pessoaFisicaInicial.dataNascimento ||
      pessoaFisicaAtual.pis !== pessoaFisicaInicial.pis ||
      pessoaFisicaAtual.nomeMae !== pessoaFisicaInicial.nomeMae
    );
  };

  const verificarAlteracoesDadosBancarios = (
    bancariosAtual,
    bancariosInicial
  ) => {
    if (!bancariosAtual || !bancariosInicial) return false;
    return (
      bancariosAtual.banco !== bancariosInicial.banco ||
      bancariosAtual.agencia !== bancariosInicial.agencia ||
      bancariosAtual.conta !== bancariosInicial.conta ||
      bancariosAtual.tipoConta !== bancariosInicial.tipoConta
    );
  };

  const verificarAlteracoesEndereco = (enderecoAtual, enderecoInicial) => {
    if (!enderecoAtual || !enderecoInicial) return false;
    return (
      enderecoAtual.cep !== enderecoInicial.cep ||
      enderecoAtual.rua !== enderecoInicial.rua ||
      enderecoAtual.numero !== enderecoInicial.numero ||
      enderecoAtual.complemento !== enderecoInicial.complemento ||
      enderecoAtual.cidade !== enderecoInicial.cidade ||
      enderecoAtual.estado !== enderecoInicial.estado
    );
  };

  const verificarAlteracoesServicos = (servicosAtuais, servicosIniciais) => {
    if (servicosAtuais.length !== servicosIniciais.length) return true;

    for (let i = 0; i < servicosAtuais.length; i++) {
      const servicoAtual = servicosAtuais[i];
      const servicoInicial = servicosIniciais[i];

      if (
        servicoAtual.mesCompetencia !== servicoInicial.mesCompetencia ||
        servicoAtual.anoCompetencia !== servicoInicial.anoCompetencia ||
        servicoAtual.valorPrincipal !== servicoInicial.valorPrincipal ||
        servicoAtual.valorBonus !== servicoInicial.valorBonus ||
        servicoAtual.valorAjusteComercial !==
          servicoInicial.valorAjusteComercial ||
        servicoAtual.valorHospedagemAnuncio !==
          servicoInicial.valorHospedagemAnuncio ||
        servicoAtual.valorTotal !== servicoInicial.valorTotal ||
        servicoAtual.status !== servicoInicial.status ||
        servicoAtual.correcao !== servicoInicial.correcao
      ) {
        return true; // Houve alteração no serviço
      }
    }

    return false; // Nenhuma alteração
  };

  const abrirConfirmarRemoverPrestador = (formik) => {
    if (formik.dirty) {
      setConfirmacao((prev) => ({ ...prev, removerPrestador: true }));
    } else {
      confirmarRemoverPrestador();
    }
  };

  const abrirConfirmarRemoverServico = (formik) => {
    if (formik.dirty) {
      setConfirmacao((prev) => ({ ...prev, removerServico: true }));
    } else {
      confirmarRemoverServico();
    }
  };

  // Funções para confirmar as ações
  const confirmarFechar = () => {
    setConfirmacao((prev) => ({ ...prev, fecharModal: false }));
    closeModal();
  };

  const confirmarRemoverPrestador = () => {
    setMostrarPrestador(false);
    setConfirmacao((prev) => ({ ...prev, removerPrestador: false }));
  };

  const confirmarRemoverServico = () => {
    setMostrarServico(false);
    setConfirmacao((prev) => ({ ...prev, removerServico: false }));
  };

  return (
    <Formik
      initialValues={combinedInitValues}
      validationSchema={combinedValidationSchema}
      onSubmit={handleSubmit}
      enableReinitialize
      validateOnChange={false}
    >
      {(formik) => (
        <>
          {/* Modal Principal */}
          <Modal
            isOpen={isOpen}
            onClose={() => abrirConfirmarFechar(formik)} // Abre o diálogo de confirmação ao tentar fechar
            size="6xl"
            isCentered
            closeOnOverlayClick={false} // Evita fechar clicando fora
          >
            <ModalOverlay />
            <Form>
              <MotionModalContent
                color="brand.800"
                bg="brand.50"
                height="90vh"
                rounded="md"
                shadow="lg"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{
                  duration: 0.4,
                  ease: "easeInOut",
                }}
              >
                <Flex direction="column" height="100%">
                  <Box
                    position="sticky"
                    top="0"
                    zIndex="1"
                    borderBottom="1px solid #e2e8f0"
                  >
                    <ModalHeader>
                      {isEditMode ? "Editar Ticket" : "Adicionar Novo Ticket"}
                    </ModalHeader>

                    <ModalCloseButton
                      onClick={() => abrirConfirmarFechar(formik)} // Aqui o formik está disponível
                    />
                  </Box>

                  <Box flex="1" overflowY="auto" p={2}>
                    <ModalBody>
                      <Flex direction={{ base: "column", md: "row" }} gap={4}>
                        <Box flex={{ base: "1", md: "3" }}>
                          <Flex direction="column" gap={4}>
                            <TicketFields />
                          </Flex>
                        </Box>
                        {isEditMode && (
                          <Box flex={{ base: "1", md: "1" }}>
                            <TicketStatusButtons ticket={ticket} />
                          </Box>
                        )}
                      </Flex>

                      <HStack spacing={4} mt={4}>
                        {!mostrarPrestador ? (
                          <Button
                            onClick={() => setMostrarPrestador(true)}
                            colorScheme="teal"
                            variant="outline"
                          >
                            Adicionar Prestador
                          </Button>
                        ) : (
                          <Button
                            onClick={abrirConfirmarRemoverPrestador}
                            colorScheme="red"
                            variant="outline"
                          >
                            Remover Prestador
                          </Button>
                        )}

                        {!mostrarServico ? (
                          <Button
                            onClick={() => setMostrarServico(true)}
                            colorScheme="teal"
                            variant="outline"
                          >
                            Adicionar Serviço
                          </Button>
                        ) : (
                          <Button
                            onClick={abrirConfirmarRemoverServico}
                            colorScheme="red"
                            variant="outline"
                          >
                            Remover Serviço
                          </Button>
                        )}
                        {isEditMode && (
                          <ImportFilesComponent ticketId={ticket._id} />
                        )}
                      </HStack>

                      {isEditMode && <FilesViewComponent />}

                      {mostrarPrestador && (
                        <Box mt={4}>
                          <PrestadorForm />
                        </Box>
                      )}

                      {mostrarServico && (
                        <Box mt={4}>
                          <ServicoForm />
                        </Box>
                      )}
                    </ModalBody>
                  </Box>

                  <ModalFooter borderTop="1px solid #e2e8f0">
                    <Flex width="100%" justifyContent="space-between">
                      <TicketActions
                        ticket={ticket}
                        isEditMode={isEditMode}
                        closeModal={abrirConfirmarFechar}
                        onCancel={abrirConfirmarFechar}
                      />
                    </Flex>
                  </ModalFooter>
                </Flex>
              </MotionModalContent>
            </Form>
          </Modal>

          {/* AlertDialogs para confirmações */}
          <AlertDialog
            isOpen={confirmacao.fecharModal}
            leastDestructiveRef={cancelRefFechar}
            onClose={() =>
              setConfirmacao((prev) => ({ ...prev, fecharModal: false }))
            }
            isCentered
          >
            <AlertDialogOverlay>
              <AlertDialogContent>
                <AlertDialogHeader fontSize="lg" fontWeight="bold">
                  Confirmar Fechamento
                </AlertDialogHeader>

                <AlertDialogBody>
                  Tem certeza de que deseja fechar o modal? Todas as alterações
                  não salvas serão perdidas.
                </AlertDialogBody>

                <AlertDialogFooter>
                  <Button
                    ref={cancelRefFechar}
                    onClick={() =>
                      setConfirmacao((prev) => ({
                        ...prev,
                        fecharModal: false,
                      }))
                    }
                  >
                    Cancelar
                  </Button>
                  <Button colorScheme="red" onClick={confirmarFechar} ml={3}>
                    Fechar
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialogOverlay>
          </AlertDialog>

          {/* Outros AlertDialogs */}
          {/* AlertDialog para confirmar remoção do prestador */}
          <AlertDialog
            isOpen={confirmacao.removerPrestador}
            leastDestructiveRef={cancelRefRemoverPrestador}
            onClose={() =>
              setConfirmacao((prev) => ({ ...prev, removerPrestador: false }))
            }
            isCentered
          >
            <AlertDialogOverlay>
              <AlertDialogContent>
                <AlertDialogHeader fontSize="lg" fontWeight="bold">
                  Confirmar Remoção do Prestador
                </AlertDialogHeader>

                <AlertDialogBody>
                  Tem certeza de que deseja remover o prestador? Esta ação não
                  pode ser desfeita.
                </AlertDialogBody>

                <AlertDialogFooter>
                  <Button
                    ref={cancelRefRemoverPrestador}
                    onClick={() =>
                      setConfirmacao((prev) => ({
                        ...prev,
                        removerPrestador: false,
                      }))
                    }
                  >
                    Cancelar
                  </Button>
                  <Button
                    colorScheme="red"
                    onClick={confirmarRemoverPrestador}
                    ml={3}
                  >
                    Remover
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialogOverlay>
          </AlertDialog>

          {/* AlertDialog para confirmação de remover serviço */}
          <AlertDialog
            isOpen={confirmacao.removerServico}
            leastDestructiveRef={cancelRefRemoverServico}
            onClose={() =>
              setConfirmacao((prev) => ({ ...prev, removerServico: false }))
            }
            isCentered
          >
            <AlertDialogOverlay>
              <AlertDialogContent>
                <AlertDialogHeader fontSize="lg" fontWeight="bold">
                  Confirmar Remoção do Serviço
                </AlertDialogHeader>

                <AlertDialogBody>
                  Tem certeza de que deseja remover o(s) serviço(s)? Esta ação
                  não pode ser desfeita.
                </AlertDialogBody>

                <AlertDialogFooter>
                  <Button
                    ref={cancelRefRemoverServico}
                    onClick={() =>
                      setConfirmacao((prev) => ({
                        ...prev,
                        removerServico: false,
                      }))
                    }
                  >
                    Cancelar
                  </Button>
                  <Button
                    colorScheme="red"
                    onClick={confirmarRemoverServico}
                    ml={3}
                  >
                    Remover
                  </Button>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialogOverlay>
          </AlertDialog>
        </>
      )}
    </Formik>
  );
};

export default TicketModal;
