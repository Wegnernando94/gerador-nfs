# # RTCListaDoc

## Propriedades

Nome | Tipo | Descrição | Comentários
------------ | ------------- | ------------- | -------------
**d_fe_nacional** | [**\NuvemFiscal\Model\RTCListaDocDFe**](RTCListaDocDFe.md) |  | [optional]
**doc_fiscal_outro** | [**\NuvemFiscal\Model\RTCListaDocFiscalOutro**](RTCListaDocFiscalOutro.md) |  | [optional]
**doc_outro** | [**\NuvemFiscal\Model\RTCListaDocOutro**](RTCListaDocOutro.md) |  | [optional]
**fornec** | [**\NuvemFiscal\Model\RTCListaDocFornec**](RTCListaDocFornec.md) |  | [optional]
**dt_emi_doc** | **\DateTime** | Data da emissão do documento dedutível  Ano, mês e dia (AAAA-MM-DD). |
**dt_comp_doc** | **\DateTime** | Data da competência do documento dedutível  Ano, mês e dia (AAAA-MM-DD). |
**tp_ree_rep_res** | **string** | Tipo de valor incluído neste documento, recebido por motivo de estarem relacionadas a operações de terceiros,  objeto de reembolso, repasse ou ressarcimento pelo recebedor, já tributados e aqui referenciados. |
**x_tp_ree_rep_res** | **string** | Descrição do reembolso ou ressarcimento quando a opção é  \&quot;99 - Outros reembolsos ou ressarcimentos recebidos por valores pagos relativos a operações por conta e ordem de terceiro\&quot;. | [optional]
**vlr_ree_rep_res** | **float** | Valor monetário (total ou parcial, conforme documento informado) utilizado para não inclusão na base de cálculo  do ISS e do IBS e da CBS da NFS-e que está sendo emitida (R$). |

[[Voltar à lista de DTOs]](../../README.md#models) [[Voltar à lista de API]](../../README.md#endpoints) [[Voltar ao README]](../../README.md)
