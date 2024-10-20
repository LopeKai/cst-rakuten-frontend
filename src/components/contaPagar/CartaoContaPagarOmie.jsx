// CartaoContaPagarOmie.js
import React, { useState, useEffect } from "react";
import { Box, Text, Spinner, Badge, useColorModeValue } from "@chakra-ui/react";
import api from "../../services/api";
import { formatDate } from "../../utils/formatDate";

const CartaoContaPagarOmie = ({ ticket }) => {
  const [contaPagar, setContaPagar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const fetchContaPagar = async () => {
      try {
        // const response = await api.get(`/contas-pagar/${ticket.contaPagarOmie}`);
        // setContaPagar(response.data);
      } catch (err) {
        console.error("Erro ao buscar conta a pagar:", err);
        setError("Erro ao buscar conta a pagar. Tentando novamente em 30 segundos...");
        setTimeout(() => {
          setRetry((prevRetry) => prevRetry + 1);
        }, 30000);
      } finally {
        setLoading(false);
      }
    };

    if (ticket.contaPagarOmie) {
      fetchContaPagar();
    } else {
      setLoading(false);
    }
  }, [ticket.contaPagarOmie, retry]);

  const bg = useColorModeValue("gray.200", "gray.600");
  const errorBg = useColorModeValue("red.100", "red.600");
  const warningBg = useColorModeValue("yellow.100", "yellow.600");
  // const successBg = useColorModeValue('green.100', 'green.600');

  if (loading) {
    return (
      <Box p={4} bg={bg} rounded="md" shadow="sm">
        <Spinner />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={4} bg={errorBg} rounded="md" shadow="sm">
        <Text color="red.500">{error}</Text>
      </Box>
    );
  }

  // if (!contaPagar) {
  //   return (
  //     <Box p={4} bg={warningBg} rounded="md" shadow="sm">
  //       <Text>Conta a pagar não encontrada.</Text>
  //     </Box>
  //   );
  // }

  return (
    <Box
      rounded="lg"
      shadow="md"
      cursor="pointer"
      bg="brand.50"
      p={2}
      my={2}
      borderWidth="1px"
      borderColor="brand.200"
      color="brand.900" 
    >
      <Text fontWeight="bold">{ticket.titulo}</Text>
      {/* <Text>Documento: {contaPagar?.numero_documento}</Text> */}
      {/* <Text>Valor: R$ {contaPagar?.valor_documento?.toFixed(2)}</Text> */}
      {/* <Text>Vencimento: {formatDate(contaPagar?.data_vencimento)}</Text> */}
      {/* <Badge colorScheme={getColorScheme(contaPagar?.status_titulo)}>
        {contaPagar?.status_titulo}
      </Badge> */}
    </Box>
  );
};

const getColorScheme = (status) => {
  switch (status.toLowerCase()) {
    case "pago":
      return "green";
    case "pendente":
      return "yellow";
    case "vencido":
      return "red";
    default:
      return "gray";
  }
};

export default CartaoContaPagarOmie;