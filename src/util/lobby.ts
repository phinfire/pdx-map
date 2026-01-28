export function calculateAssignments<U, T>(
    choices: T[],
    signups: { user: U; picks: T[] }[]
): Map<T, U> {
    const n = choices.length;
    const m = signups.length;
    if (n < m) {
        throw new Error("Number of choices must be >= number of signups");
    }
    const utilityMatrix: number[][] = signups.map((s) => {
        return choices.map((choice) => {
            const idx = s.picks.indexOf(choice as T);
            if (idx === -1) return 0;
            return 10 + 2 * (s.picks.length - idx);
        });
    });
    const maxUtility = Math.max(...utilityMatrix.flat());
    const costMatrix = utilityMatrix.map((row) =>
        row.map((u) => maxUtility - u)
    );
    const size = Math.max(n, m);
    const matrix: number[][] = Array.from({ length: size }, (_, i) =>
        Array.from({ length: size }, (_, j) =>
            i < m && j < n ? costMatrix[i][j] : 0
        )
    );
    const assignment = hungarian(matrix);
    const result = new Map<T, U>();
    for (let i = 0; i < assignment.length; i++) {
        const j = assignment[i];
        if (i < m && j < n) {
            result.set(choices[j], signups[i].user);
        }
    }
    return result;
}

function hungarian(costMatrix: number[][]): number[] {
    const n = costMatrix.length;
    const u = Array(n + 1).fill(0);
    const v = Array(n + 1).fill(0);
    const p = Array(n + 1).fill(0);
    const way = Array(n + 1).fill(0);

    for (let i = 1; i <= n; i++) {
        p[0] = i;
        let j0 = 0;
        const minv = Array(n + 1).fill(Infinity);
        const used = Array(n + 1).fill(false);

        do {
            used[j0] = true;
            const i0 = p[j0];
            let delta = Infinity;
            let j1 = 0;

            for (let j = 1; j <= n; j++) {
                if (!used[j]) {
                    const cur = costMatrix[i0 - 1][j - 1] - u[i0] - v[j];
                    if (cur < minv[j]) {
                        minv[j] = cur;
                        way[j] = j0;
                    }
                    if (minv[j] < delta) {
                        delta = minv[j];
                        j1 = j;
                    }
                }
            }

            for (let j = 0; j <= n; j++) {
                if (used[j]) {
                    u[p[j]] += delta;
                    v[j] -= delta;
                } else {
                    minv[j] -= delta;
                }
            }

            j0 = j1;
        } while (p[j0] !== 0);

        do {
            const j1 = way[j0];
            p[j0] = p[j1];
            j0 = j1;
        } while (j0 !== 0);
    }

    const result = Array(n).fill(-1);
    for (let j = 1; j <= n; j++) {
        if (p[j] > 0 && p[j] <= n) {
            result[p[j] - 1] = j - 1;
        }
    }
    return result;
}