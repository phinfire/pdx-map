import { AccumulatableCurrenty as AccumulatableCurrency } from "./AccumulatableCurrency";
import { CK3 } from "./CK3";
import { Save } from "./Ck3Save";
import { LandedTitle } from "./LandedTitle";
import { RulerTier } from "./RulerTier";
import { Skill } from "./enum/Skill";
import { Trait } from "./Trait";

export class Character {
    
    constructor(private id: string, private data: any, private save: Save, private ck3: CK3) {
        
    }

    public getDynastyHouse() {
        return this.save.getDynastyHouseAndDynastyData(this.data.dynasty_house);
    }

    public isFemale() {
        if (this.data.female) {
            return true;
        }
        return false;
    }

    public getId() {
        return parseInt(this.id);
    }

    public isAlive(): boolean {
        return this.data.alive_data != null;
    }

    public isLanded(): boolean {
        return this.data.landed_data != null;
    }

    public getBirth() {
        const parts =  this.data.birth.split(".");
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }

    public getName() {
        return this.data.first_name;
    }

    public getPerks() {
        return this.getAliveValue("perk", []);
    }

    public getFaith() {
        if (this.data.faith) {
            return this.save.getFaith(this.data.faith);
        }
        return null;
    }

    public getCulture() {
        if (this.data.culture) {
            return this.save.getCulture(this.data.culture);
        }
        throw new Error("Character " + this.getId() + " has no culture set");
    }

    public getCash() {
        return this.getAliveValue("gold", 0);
    }

    public getIncome() {
        return this.getAliveValue("income", 0);
    }

    public getBalance() {
        return this.getLandedValue("balance", 0);
    }

    public getTraits() : Trait[] {
        return (this.data.traits || []).map((traitIndex: any) => {
            return this.ck3.getTraitByIndex(traitIndex);
        });
    }

    public getChildren() {
        if (this.data.family_data && this.data.family_data.child) {
            return this.data.family_data.child.map((child: any) => this.save.getCharacter(child)).filter((child: any) => child != null).sort((a: any, b: any) => a.getBirth().getTime() - b.getBirth().getTime());
        }
        return [];
    }

    public getSkills() {
        const skills = this.getBaseSkills().map((skill: number) => skill);
        this.getTraits().forEach((trait: Trait) => {
            const arr = CK3.SKILLS_IN_ORDER.map(() => 0);
            CK3.SKILLS_IN_ORDER.forEach((skill: Skill) => {
                arr[CK3.SKILLS_IN_ORDER.indexOf(skill)] += trait.getSkillChange(skill);
            });
            for (let i = 0; i < arr.length; i++) {
                skills[i] += arr[i];
            }
        });
        return skills.map((skill: number) => Math.max(0, skill));
    }

    public getBaseSkills() {
        return this.data.skill || [];
    }

    public getLandedValue(key: string, defaultValue: any) {
        if (this.data.landed_data && this.data.landed_data[key]) {
            return this.data.landed_data[key];
        }
        return defaultValue;
    }

    public getAliveValue(key: string, defaultValue: any) {
        if (this.data.alive_data && this.data.alive_data[key]) {
            return this.data.alive_data[key];
        }
        return defaultValue;
    }

    public getPlayableData(key: string, defaultValue: any) {
        if (this.data.playable_data && this.data.playable_data[key]) {
            return this.data.playable_data[key];
        }
        return defaultValue;
    }

    public getFamilyData(key: string, defaultValue: any) {
        if (this.data.family_data && this.data.family_data[key]) {
            return this.data.family_data[key];
        }
        return defaultValue;
    }

    public getPrestige() {
        return this.data.alive_data ? new AccumulatableCurrency(this.data.alive_data.prestige) : AccumulatableCurrency.NONE;
    }

    public getPiety() {
        return this.data.alive_data ? new AccumulatableCurrency(this.data.alive_data.piety) : AccumulatableCurrency.NONE;
    }

    public getKnights() {
        return this.getPlayableData("knights", []).map((knight: any) => {
            return this.save.getCharacter(knight);
        });
    }

    public getCouncillors() : Character[] {
        return this.getLandedValue("council", []).map((councilor: any) => {
            return this.save.getCharacter(councilor);
        });
    }

    public getPlayerName() {
        return this.save.getPlayerNameByCharId(this.getId());
    }

    public getCharacterTier() : RulerTier {
        if (this.isLanded()) {
            return this.getHighestTitle().getTier();
        }
        return RulerTier.NONE;
    }

    public getHighestTitle() {
        const titles = this.getTitles();
        return titles.reduce((prev: LandedTitle, current: LandedTitle) => prev.getTier().compare(current.getTier()) > 0 ? prev : current);
    }

    public getDomainBaronies() {
        return this.getTitles().filter((title: LandedTitle) => title.getTier() == RulerTier.BARON);
    }

    public getTitles() {
        return this.save.getHeldTitles(this);
    }

    public getPrimaryTitle() {
        if (this.data.landed_data && this.data.landed_data.domain) {
            const firstDomainTitle = this.save.getTitleByIndex(this.data.landed_data.domain[0]);
            return firstDomainTitle;
        }
        return null;
    }

    public getLevies() {
        return this.getLandedValue("levy", 0);
    }

    public getNonLevyTroops() {
        return this.getLandedValue("strength_without_hires", 0) - this.getLevies();
    }

    public getSpouses(includeFormer: boolean) {
        const primary = this.getFamilyData("primary_spouse", null);
        if (primary == null) {
            return [];
        }
        const secondarySpouseOrSpouses = this.getFamilyData("spouse", []);
        const secondarySpouses = Array.isArray(secondarySpouseOrSpouses) ? secondarySpouseOrSpouses : [secondarySpouseOrSpouses];
        const formerSpouses = (includeFormer ? this.getFamilyData("former_spouse", []) : []);
        return ([...formerSpouses, ...secondarySpouses.filter(s => s != primary), primary].map((spouse: any) => this.save.getCharacter(spouse)).filter((spouse: any) => spouse != null));
    }

    public getVisistedPointsOfInterest() {
        return this.getAliveValue("visited_points_of_interest", []);
    }

    public getAge() {
        const currentDate = new Date(this.save.getCurrentDate());
        const birthDate = this.getBirth();
        if (currentDate.getMonth() < birthDate.getMonth() || (currentDate.getMonth() == birthDate.getMonth() && currentDate.getDate() < birthDate.getDate())) {
            return currentDate.getFullYear() - birthDate.getFullYear() - 1;
        }
        return currentDate.getFullYear() - birthDate.getFullYear();
    }

    public getVassals() {
        const vassalCharId2Title = new Map<string, number[]>();
        return [];
    }

    public equals(other: Character) {
        return this.id == other.id;
    }
}