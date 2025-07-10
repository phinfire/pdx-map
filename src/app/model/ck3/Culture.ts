export class Culture {

    constructor(private cultureId: number, private cultureData: any) {

    }

    public getId() {
        return this.cultureId;
    }

    public getName() {
        return this.cultureData.name ? this.cultureData.name : this.cultureData.culture_template;
    }

    public getResearchedInnovationNames() {
        return this.cultureData.culture_innovation.map((innovation: any) => {
            if (innovation.progress == 100) {
                return innovation.type;
            }
            return null;
        }).filter((innovation: any) => innovation != null);
    }
}