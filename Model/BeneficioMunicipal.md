# # BeneficioMunicipal

## Propriedades

Nome | Tipo | Descrição | Comentários
------------ | ------------- | ------------- | -------------
**tp_bm** | **int** | Tipo do Benefício Municipal:  * 1 - Alíquota Diferenciada  * 2 - Redução da BC  * 3 - Isenção    **Atenção**: Para emissões pelo Sistema Nacional NFS-e, esse campo é ignorado. | [optional]
**n_bm** | **string** | Identificador do benefício parametrizado pelo município.  Trata-se de um identificador único que foi gerado pelo Sistema Nacional no momento em que o município de incidência do ISSQN incluiu o benefício no sistema.  Critério de formação do número de identificação de parâmetros municipais:  7 dígitos - posição 1 a 7: número identificador do Município, conforme código IBGE  2 dígitos - posições 8 e 9 : número identificador do tipo de parametrização (01-legislação, 02-regimes especiais, 03-retenções, 04-outros benefícios)  5 dígitos - posição 10 a 14 : número sequencial definido pelo sistema quando do registro específico do parâmetro dentro do tipo de parametrização no sistema. |
**v_red_bcbm** | **float** | Valor monetário informado pelo emitente para redução da base de cálculo (BC) do ISSQN devido a um Benefício Municipal (BM). | [optional]
**p_red_bcbm** | **float** | Valor percentual informado pelo emitente para redução da base de cálculo (BC) do ISSQN devido a um Benefício Municipal (BM). | [optional]

[[Voltar à lista de DTOs]](../../README.md#models) [[Voltar à lista de API]](../../README.md#endpoints) [[Voltar ao README]](../../README.md)
