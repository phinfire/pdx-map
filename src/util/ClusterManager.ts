export class ClusterManager {
    private clusterToBuddies = new Map<string, string[]>();
    private keyToCluster = new Map<string, string>();
    
    constructor(key2ClusterKey: Map<string, string>) {
        this.buildMappings(key2ClusterKey);
    }

    getBuddies(key: string): string[] {
        const cluster = this.keyToCluster.get(key);
        return cluster ? (this.clusterToBuddies.get(cluster) || [key]) : [key];
    }

    getClusterKey(key: string): string | null {
        return this.keyToCluster.get(key) || null;
    }

    getAllClusters(): string[] {
        return Array.from(this.clusterToBuddies.keys());
    }

    getClusterSize(clusterKey: string): number {
        return this.clusterToBuddies.get(clusterKey)?.length || 0;
    }

    getCluster2Keys(clusterKey: string): string[] {
        return this.clusterToBuddies.get(clusterKey) || [];
    }

    private buildMappings(key2ClusterKey: Map<string, string>): void {
        for (const [county, cluster] of key2ClusterKey.entries()) {
            this.keyToCluster.set(county, cluster);
            
            if (!this.clusterToBuddies.has(cluster)) {
                this.clusterToBuddies.set(cluster, []);
            }
            this.clusterToBuddies.get(cluster)!.push(county);
        }
    }
}
