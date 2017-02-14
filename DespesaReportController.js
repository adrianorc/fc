(function () {
    "use strict";

    angular
        .module("MetronicApp")
        .controller("DespesaReportController", ["despesaResource", "centroCustoResource", "categoriaResource", "filtrosService", "$filter", DespesaReportController]);

    function DespesaReportController(
            despesaResource,
            centroCustoResource,
            categoriaResource,
            filtrosService,
            $filter
    ) {
        var vm = this;

        // constructor
        vm.init = function () {
            // subtitulo da pagina
            vm.pageCaption = "relatório";

            //Combos
            vm.centroCustosCombo = [];
            vm.categoriasCombo = [];

            //Carregamento dos combos
            vm.loadComboCentroCustos();
            vm.loadComboCategorias();

            vm.filtros = filtrosService.getFiltro("DespesaReport");
            vm.filtros.tituloParaRelatorio = "Relatório de Contas a Pagar";

            if (!('grupo' in vm.filtros)) {
                vm.filtros.grupo = "";
            }
            
            if (!('pessoa' in vm.filtros)) {
                vm.filtros.pessoa = {
                    id: null,
                    nome: ""
                };
            }

            // iniciando o campo de data range somente se ele já não tiver inicialdo
            if ((!('dataVencimentoInicio' in vm.filtros) || vm.filtros.dataVencimentoInicio == '') && (!('dataVencimentoTermino' in vm.filtros) || vm.filtros.dataVencimentoTermino == '')) {
                vm.filtros.dataVencimentoInicio = moment().startOf('month').toISOString();
                vm.filtros.dataVencimentoTermino = moment().endOf('month').toISOString();
            }
        }

        // carrega o combo de centro de custos
        vm.loadComboCentroCustos = function () {
            centroCustoResource.query(function (data) {
                vm.centroCustosCombo = data;
            });
        }

        // carrega o combo de loadComboCategorias
        vm.loadComboCategorias = function () {
            categoriaResource.query({
                somenteSubcategorias: true,
                natureza: 1 //Despesa
            }, function (data) {
                vm.categoriasCombo = data;
            });
        }

        //Imprime
        vm.imprimir = function () {
            vm.categoriaFiltro = "";
            vm.centroCustoFiltro = "";
            vm.margin = 40;

            filtrosService.saveFiltro("DespesaReport", vm.filtros);

            var queryParans = angular.copy(vm.filtros);
            queryParans.ordem = "1";  // indica que a ordem do relatório deve ser por centro de custo -> data vencimento

            if (queryParans.pessoa != undefined) {
                if (typeof (queryParans.pessoa) == "string") {
                    queryParans.pessoa = null;
                } else {
                    if ('id' in queryParans.pessoa)
                        queryParans.pessoa = queryParans.pessoa.id;
                    else
                        queryParans.pessoa = null;
                }
            }

            if (queryParans.centroCusto != undefined) {
                if (typeof (queryParans.centroCusto) == "string") {
                    queryParans.centroCusto = null;
                } else {
                    if ('id' in queryParans.centroCusto) {
                        vm.centroCustoFiltro = queryParans.centroCusto.nome;
                        vm.margin += 20;
                        queryParans.centroCusto = queryParans.centroCusto.id;
                    } else
                        queryParans.centroCusto = null;
                }
            }

            if (queryParans.categoria != undefined) {
                if (typeof (queryParans.categoria) == "string") {
                    queryParans.categoria = null;
                } else {
                    if ('id' in queryParans.categoria) {
                        vm.categoriaFiltro = queryParans.categoria.descricao;
                        vm.margin += 20;
                        queryParans.categoria = queryParans.categoria.id;
                    } else
                        queryParans.categoria = null;
                }
            }

            despesaResource.query(queryParans, function (data, headers) {
                var dados = data;

                var doc = new jsPDF('l', 'pt');

                var columns = [
                        { title: "Núm.", dataKey: "num" },
                        { title: "Vencimento", dataKey: "venc" },
                        { title: "Credor", dataKey: "cred" },
                        { title: "Descrição", dataKey: "desc" },
                        { title: "Subcategoria", dataKey: "categ" },
                        { title: "Item", dataKey: "item" },
                        { title: "Valor", dataKey: "valor" }
                    ];
                

                var rows = [];
                var sum = 0;


                var funcInserieLinha = function (linha) {
                    rows.push(linha);
                }

                var funcSaltaLinha = function () {
                    funcInserieLinha({
                        "venc": "",
                        "cred": "",
                        "desc": "",
                        "categ": "",
                        "item": "",
                        "valor": ""
                    });
                }

                var getCategoria = function (d) {
                    if (null == d.categoria) {
                        return "";
                    };

                    if (null == d.categoria.categoriaPai) {
                        return d.categoria.descricao;
                    }

                    return d.categoria.categoriaPai.descricao;
                }

                var getCategoriaNome = function (d) {
                    if (null == d.categoria) {
                        return "";
                    };

                    return d.categoria.descricao;
                }

                var lastCentroCustoNome = "";
                var lastCategoriaNome = "";
                var lastCategoriaValor = 0;

                for (var i = 0; i < dados.length; i++) {
                    var d = dados[i];

                    //-- quebra por centro de custo
                    if ( d.centroCusto != null && (lastCentroCustoNome != d.centroCusto.nome)) {

                        if (lastCentroCustoNome != "") {
                            funcSaltaLinha();
                        }

                        lastCentroCustoNome = d.centroCusto.nome;
                        lastCategoriaNome = "";

                        funcInserieLinha({
                            "rowCentroCusto": 1,
                            "venc": "",
                            "cred": lastCentroCustoNome.toUpperCase(),
                            "desc": "",
                            "categ": "",
                            "situ": "",
                            "item": "",
                            "valor": ""
                        });
                    }

                    //-- quebra por categoria
                    if ((lastCategoriaNome != getCategoriaNome(d))) {

                        if (lastCategoriaValor != 0) {
                            funcInserieLinha({
                                "rowSoma": 1,
                                "venc": "",
                                "cred": "",
                                "desc": "",
                                "categ": "",
                                "situ": "",
                                "item": "",
                                "valor": $filter("number")(lastCategoriaValor, "2")
                            });

                            lastCategoriaValor = 0;
                        }

                        if (lastCategoriaNome != "") {
                            funcSaltaLinha();
                        }

                        lastCategoriaNome = getCategoriaNome(d);

                        funcInserieLinha({
                            "rowCategoria": 1,
                            "venc": "",
                            "cred": lastCategoriaNome,
                            "desc": "",
                            "categ": "",
                            "situ": "",
                            "item": "",
                            "valor": ""
                        });
                    }

                    funcInserieLinha({
                        "num": (typeof (d.documento) != 'undefined' && d.documento != null ? d.documento : ""),
                        "venc": $filter("date")(d.vencimento, "dd/MM/yyyy"),
                        "pgto": $filter("date")(d.pagamento, "dd/MM/yyyy"),
                        "cred": (d.pessoa != "undefined" && d.pessoa != null) ? d.pessoa.nome : "",
                        "desc": d.descricao,
                        "categ": getCategoria(d),
                        "item": d.parcela + "/" + d.ocorrencias,
                        "situ": d.pago ? "Pago" : "Pendente",
                        "valor": $filter("number")(d.valor, "2")
                    });

                    sum = sum + (d.valor != 'undefined' ? d.valor : 0);
                    lastCategoriaValor = lastCategoriaValor + (d.valor != 'undefined' ? d.valor : 0);
                }

                funcInserieLinha({
                    "venc": "", 
                    "cred": "",
                    "desc": "",
                    "situ": "",
                    "item": "Total", 
                    "valor": $filter("number")(sum, "2")
                });

                doc.autoTable(columns, rows, {
                    theme: 'plain',
                    margin: { top: vm.margin },
                    columnStyles: {
                        valor: { fontStyle: "bold", halign: "right" }
                    },
                    headerStyles: {
                        fontSize: 9,
                        valign: 'middle'
                    },
                    bodyStyles: {
                        fontSize: 9,
                        overflow: 'linebreak',
                        valign: 'middle'
                    },
                    beforePageContent: function (data) {
                        doc.setFontSize(16);
                        doc.setFontStyle("bold")
                        doc.text(queryParans.tituloParaRelatorio, 40, 30);
                        if (vm.centroCustoFiltro != "") doc.text(vm.centroCustoFiltro, 40, 50);
                        if (vm.categoriaFiltro != "") doc.text(vm.categoriaFiltro, 40, 70);
                    },
                    drawRow: function (row) {
                        if ("rowCentroCusto" in row.raw) {
                            row.cells.cred.styles.fontSize = "10";
                            row.cells.cred.styles.fontStyle = "bold";
                        }
                        if ("rowCategoria" in row.raw) {
                            row.cells.cred.styles.fontSize = "10";
                            row.cells.cred.styles.fontStyle = "italic";
                        }
                        if ("rowSoma" in row.raw) {
                            row.cells.desc.styles.fontSize = "10";
                            row.cells.desc.styles.fontStyle = "bold";

                            row.cells.valor.styles.fontSize = "10";
                            row.cells.valor.styles.fontStyle = "bold";
                        }

                    }
                });
                doc.save('contas_a_pagar.pdf');
            });
           
        }

        vm.init();
    }

})();
