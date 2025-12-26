import { Vic3GameFilesService } from './Vic3GameFilesService';
import { MapStateRegion } from './game/MapStateRegion';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Vic3GameFilesService', () => {
  let service: Vic3GameFilesService;

  describe('scalePopulationsByCountry', () => {
    beforeEach(() => {
      const mockHttpClient = {
        get: vi.fn().mockReturnValue({
          pipe: vi.fn().mockReturnValue({
            subscribe: vi.fn()
          })
        })
      };

      const mockPdxFileService = {
        parseContentToJsonPromise: vi.fn(),
        importFilePromise: vi.fn()
      };

      service = new Vic3GameFilesService(mockHttpClient as any, mockPdxFileService as any);
    });

    it('should scale population sizes by country factor', () => {
      const pops = [
        { state: 's1', countryTag: 'country_a', culture: 'culture1', religion: 'religion1', size: 100 } as any,
        { state: 's2', countryTag: 'country_a', culture: 'culture2', religion: 'religion2', size: 200 } as any,
        { state: 's3', countryTag: 'country_b', culture: 'culture3', religion: 'religion3', size: 150 } as any
      ];
      const scalingFactors = new Map([
        ['country_a', 1.5],
        ['country_b', 0.5]
      ]);

      const scaled = service.scalePopulationsByCountry(pops, scalingFactors);
      expect(scaled[0].size).toBe(150);
      expect(scaled[1].size).toBe(300);
      expect(scaled[2].size).toBe(75);
    });

    it('should use default scaling factor of 1 if country not found', () => {
      const pops = [
        { state: 's1', countryTag: 'unknown', culture: 'culture1', religion: 'religion1', size: 100 } as any
      ];
      const scalingFactors = new Map([
        ['known', 2.0]
      ]);

      const scaled = service.scalePopulationsByCountry(pops, scalingFactors);
      expect(scaled[0].size).toBe(100);
    });

    it('should floor scaled population sizes', () => {
      const pops = [
        { state: 's1', countryTag: 'country_a', culture: 'culture1', religion: 'religion1', size: 100 } as any
      ];
      const scalingFactors = new Map([
        ['country_a', 1.7]
      ]);

      const scaled = service.scalePopulationsByCountry(pops, scalingFactors);
      expect(scaled[0].size).toBe(170);
    });
  });

  describe('MapStateRegion', () => {
    it('should store and retrieve filename', () => {
      const region = new MapStateRegion(
        'test_state',
        'test_id',
        new Set(['tile1', 'tile2']),
        100,
        new Set(['wheat']),
        new Map(),
        'test_file.txt'
      );

      expect(region.getFilename()).toBe('test_file.txt');
      expect(region.getName()).toBe('test_state');
      expect(region.getIdentifier()).toBe('test_id');
      expect(region.getArableLand()).toBe(100);
    });

    it('should return readonly tiles set', () => {
      const tiles = new Set(['tile1', 'tile2', 'tile3']);
      const region = new MapStateRegion(
        'test_state',
        'test_id',
        tiles,
        100,
        new Set(),
        new Map(),
        'test.txt'
      );

      const retrievedTiles = region.getTiles();
      expect(retrievedTiles.size).toBe(3);
      expect(retrievedTiles.has('tile1')).toBe(true);
      expect(retrievedTiles.has('tile2')).toBe(true);
      expect(retrievedTiles.has('tile3')).toBe(true);
    });

    it('should return readonly farm types', () => {
      const farmTypes = new Set(['wheat', 'rye', 'barley']);
      const region = new MapStateRegion(
        'test_state',
        'test_id',
        new Set(['tile1']),
        100,
        farmTypes,
        new Map(),
        'test.txt'
      );

      const retrieved = region.getPossibleFarmTypes();
      expect(retrieved.size).toBe(3);
      expect(retrieved.has('wheat')).toBe(true);
    });
  });
});
