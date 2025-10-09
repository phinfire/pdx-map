import { AccumulatableCurrenty as AccumulatableCurrency } from "./AccumulatableCurrency";
import { CK3 } from "./CK3";
import { RulerTier } from "./RulerTier";
import { Skill } from "./enum/Skill";
import { Trait } from "./Trait";
import { AbstractLandedTitle } from "./title/AbstractLandedTitle";
import { ICk3Save } from "./save/ICk3Save";

export class Character {

    static fromRawData(id: string, data: any, save: ICk3Save, ck3: CK3): Character {
        return new Character(id, data, save, ck3);
    }

    private traits: Trait[] = [];
    private female: boolean;
    private landed: boolean
    private birthDate: Date;
    private deathDate: Date | null;

    children: Character[] = [];

    cachedHeldTitles: AbstractLandedTitle[] | null = null;

    constructor(private id: string, private data: any, private save: ICk3Save, private ck3: CK3) {
        this.traits = (this.data.traits || []).map((traitIndex: any) => this.ck3.getTraitByIndex(traitIndex));
        this.female = data.female ? true : false;
        this.landed = data.landed_data != null;
        this.children = this.getChildren();
        if (this.data.family_data && this.data.family_data.child) {
            this.children =  this.data.family_data.child
                .map((child: any) => this.save.getCharacter(child))
                .filter((child: any) => child != null).sort((a: any, b: any) => a.getBirthDate().getTime() - b.getBirthDate().getTime());
        } else {
            this.children = [];
        }
        if (!this.data.birth) {
            throw new Error("Character " + this.getCharacterId() + " has no birth date set");
        }
        this.birthDate = this.data.birth;
        this.deathDate = this.data.dead_data ? this.data.dead_data.date : null;
    }

    public getDynastyHouse() {
        return this.save.getDynastyHouse(this.data.dynasty_house);
    }

    public isFemale() {
        return this.female;
    }

    public getCharacterId() {
        return this.id;
    }

    public isAlive(): boolean {
        return this.deathDate == null;
    }

    public isLanded(): boolean {
        return this.landed;
    }

    public getBirthDate() {
        return this.birthDate;
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
        //throw new Error("Character " + this.getCharacterId() + " has no culture set");
        return null;
    }

    public getCash() {
        return this.getAliveValue("gold", {value: 0}).value;
    }

    public getIncome() {
        return this.getAliveValue("income", 0);
    }

    public getBalance() {
        return this.getLandedValue("balance", 0);
    }

    public getTraits() : Trait[] {
        return this.traits;;
    }

    public getChildren() {
        return this.children;
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

    public getLandedValue<T>(key: string, defaultValue: T) {
        if (this.data.landed_data && this.data.landed_data[key]) {
            return this.data.landed_data[key];
        }
        return defaultValue;
    }

    public getAliveValue<T>(key: string, defaultValue: T) {
        if (this.data.alive_data && this.data.alive_data[key]) {
            return this.data.alive_data[key];
        }
        return defaultValue;
    }

    public getPlayableData<T>(key: string, defaultValue: T) {
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
        return this.save.getPlayerNameByCharacterId(this.getCharacterId());
    }

    public getCharacterTier() : RulerTier {
        return this.isLanded() ?  this.getHighestTitle()!.getTier() : RulerTier.NONE;
    }

    public getHighestTitle() {
        const titles = this.getTitles();
        if (titles.length === 0) {
            return null;
        }
        return titles.reduce((prev: AbstractLandedTitle, current: AbstractLandedTitle) => prev.getTier().compare(current.getTier()) > 0 ? prev : current, titles[0]);
    }

    public getDomainBaronies() {
        return this.getTitles().filter((title: AbstractLandedTitle) => title.getTier() == RulerTier.BARON);
    }

    public getTitles() {
        if (this.cachedHeldTitles == null) {
            this.cachedHeldTitles = this.save.getHeldTitles(this).sort((a, b) => b.getTier().compare(a.getTier()) || b.getLocalisedName().localeCompare(a.getLocalisedName()));
        }
        return this.cachedHeldTitles;
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
        if (!this.isAlive()) {
            return this.getAgeAtDeath();
        }
        const currentDate = new Date(this.save.getIngameDate());
        const birthDate = this.getBirthDate();
        if (currentDate.getMonth() < birthDate.getMonth() || (currentDate.getMonth() == birthDate.getMonth() && currentDate.getDate() < birthDate.getDate())) {
            return currentDate.getFullYear() - birthDate.getFullYear() - 1;
        }
        return currentDate.getFullYear() - birthDate.getFullYear();
    }

    public getAgeAtDeath() {
        if (this.isAlive()) {
            throw new Error("Character " + this.getCharacterId() + " is still alive");
        }
        const deathDate = this.deathDate!;
        const birthDate = this.getBirthDate();
        return deathDate.getFullYear() - birthDate.getFullYear();
    }

    public equals(other: Character) {
        return this.getCharacterId() === other.getCharacterId();
    }
}