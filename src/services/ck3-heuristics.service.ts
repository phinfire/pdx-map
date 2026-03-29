import { Injectable } from '@angular/core';
import { ICk3Save } from '../model/ck3/save/ICk3Save';
import { Character } from '../model/ck3/Character';
import { RGB } from '../util/RGB';

@Injectable({
    providedIn: 'root',
})
export class Ck3HeuristicsService {

    buildTimeBarData(save: ICk3Save) {
        const timeBarData: {
            label: string;
            startDate: Date;
            endDate: Date;
            rowName: string;
            color: string;
            guessing: boolean;
        }[] = [];
        for (const player of save.getPlayers()) {
            const charactersByDate = new Map<string, Character>();
            for (const [date, character] of player.getPreviousCharacters()) {
                charactersByDate.set(date, character);
            }
            const currentChar = player.getCurrentCharacter();
            if (currentChar) {
                charactersByDate.set(new Date().toISOString(), currentChar);
            }
            const sortedDates = Array.from(charactersByDate.keys()).sort((a, b) => {
                const dateA = new Date(a).getTime();
                const dateB = new Date(b).getTime();
                return dateA - dateB;
            });
            for (let i = 0; i < sortedDates.length; i++) {
                const character = charactersByDate.get(sortedDates[i])!;
                const startDate = new Date(sortedDates[i]);
                const endDate = i + 1 < sortedDates.length
                    ? new Date(sortedDates[i + 1])
                    : (character.isAlive() ? save.getIngameDate() : character.getDeathDate())!;
                let color = new RGB(64, 64, 64);
                let label = "";
                const primaryTitle = character.getPrimaryTitle();
                if (primaryTitle) {
                    label = primaryTitle.getTier().getRulerTitle() + " " + character.getName()  + " of " + primaryTitle.getLocalisedName();
                    color = primaryTitle.getColor();
                } else {
                    label = character.getName();
                }
                timeBarData.push({
                    label,
                    startDate,
                    endDate,
                    rowName: player.getName(),
                    color: color.toHexString(),
                    guessing: false
                });
            }
        }
        return timeBarData
    }
}
