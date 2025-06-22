export class CountryBudget {

    public static NONE = new CountryBudget(0, 0, 0, 0, new Map<string, number>(), [], []);

    /* weekly_income
    0 ?
    1 income tax
    2 poll tax
    3 consumption tax
    4 ?
    5 ?
    6 ?
    7 inv transfer?
    8 minting
    9 tariffs
    10 gov div
    ?
    ?
    ?

    weeekly_expense
    0 ?
    1 ?
    2 gov goods
    3 gov wages
    4 ?
    5 mil goods
    6 mil wages
    7 cons goods
    8 subsidies
    9 interest
    */

    public static fromRawData(rawData: any): CountryBudget {
        const credit = rawData["credit"] || 0;
        const cash = rawData["money"] || 0;
        const debt = rawData["principal"] || 0;
        const investmentPool = rawData["investment_pool"] || 0;
        const investmentPoolGrowth = rawData["investment"]
            ? new Map<string, number>(
                Object.entries(rawData["investment"]).map(
                    ([key, val]) => [key.replace("building_", ""), Number(val)]
                )
            )
            : new Map<string, number>();
        const expenseList = rawData["weekly_expenses"];
        const incomeList = rawData["weekly_income"];
        if (!expenseList || !incomeList) {
            console.error("Invalid raw data: weekly_expense or weekly_income is missing", rawData);
        }
        return new CountryBudget(credit, cash, debt, investmentPool, investmentPoolGrowth, expenseList, incomeList);
    }

    public static fromJson(json: any): CountryBudget {
        return new CountryBudget(
            json.credit,
            json.cash,
            json.debt,
            json.investmentPool,
            new Map<string, number>(Object.entries(json.investmentPoolGrowth)),
            json.weekly_expense,
            json.weekly_income
        );
    }

    constructor(
        private credit: number,
        private cash: number,
        private debt: number,
        private investmentPool: number,
        private investmentPoolGrowth: Map<string, number>,
        private expenseList: number[],
        private incomeList: number[]
    ) { }


    toJson(): any {
        return {
            credit: this.credit,
            cash: this.cash,
            debt: this.debt,
            investmentPool: this.investmentPool,
            investmentPoolGrowth: Object.fromEntries(this.investmentPoolGrowth),
            weekly_expense: this.expenseList,
            weekly_income: this.incomeList
        };
    }

    getCredit(): number {
        return this.credit;
    }

    getNetCash(): number {
        return this.cash - this.debt;
    }

    getInvestmentPool(): number {
        return this.investmentPool;
    }

    getInvestmentPoolGrowth(): Map<string, number> {
        return this.investmentPoolGrowth;
    }

    getTaxIncome(): number {
        return this.getIncome(1) + this.getIncome(2) + this.getIncome(3);
    }

    getMintingIncome(): number {
        return this.getIncome(8);
    }

    getTotalIncomeWithoutInvestmentTransfer(): number {
        return this.incomeList.reduce((sum, income) => sum + income, 0) - this.getIncome(7);
    }

    getTotalExpenses(): number {
        return this.expenseList.reduce((sum, expense) => sum + expense, 0);
    }

    getNetIncome(): number {
        return this.getTotalIncomeWithoutInvestmentTransfer() - this.getTotalExpenses();
    }

    getConstructionCosts(): number {
        return this.getExpense(7);
    }

    getInterest(): number {
        return this.getExpense(9);
    }

    private getExpense(index: number): number {
        if (index < 0 || index >= this.expenseList.length) {
            return 0;
        }
        return this.expenseList[index];
    }

    private getIncome(index: number): number {
        if (index < 0 || index >= this.incomeList.length) {
            return 0;
        }
        return this.incomeList[index];
    }
}