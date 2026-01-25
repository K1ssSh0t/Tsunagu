export namespace character {
	
	export class Skin {
	    name: string;
	    folder: string;
	
	    static createFrom(source: any = {}) {
	        return new Skin(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.folder = source["folder"];
	    }
	}
	export class Character {
	    name: string;
	    mods: mod.Mod[];
	    hasFolder: boolean;
	    skins: Skin[];
	
	    static createFrom(source: any = {}) {
	        return new Character(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.mods = this.convertValues(source["mods"], mod.Mod);
	        this.hasFolder = source["hasFolder"];
	        this.skins = this.convertValues(source["skins"], Skin);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace config {
	
	export class GameConfig {
	    modsPath: string;
	
	    static createFrom(source: any = {}) {
	        return new GameConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.modsPath = source["modsPath"];
	    }
	}
	export class Config {
	    games: Record<string, GameConfig>;
	    selectedGame: string;
	
	    static createFrom(source: any = {}) {
	        return new Config(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.games = this.convertValues(source["games"], GameConfig, true);
	        this.selectedGame = source["selectedGame"];
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

export namespace mod {
	
	export class Mod {
	    id: string;
	    character: string;
	    name: string;
	    isActive: boolean;
	    fullPath: string;
	    gameBananaUrl: string;
	    imagePath: string;
	
	    static createFrom(source: any = {}) {
	        return new Mod(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.character = source["character"];
	        this.name = source["name"];
	        this.isActive = source["isActive"];
	        this.fullPath = source["fullPath"];
	        this.gameBananaUrl = source["gameBananaUrl"];
	        this.imagePath = source["imagePath"];
	    }
	}
	export class ModUpdate {
	    characterName: string;
	    modName: string;
	    modUrl: string;
	    localDate: string;
	    remoteDate: string;
	
	    static createFrom(source: any = {}) {
	        return new ModUpdate(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.characterName = source["characterName"];
	        this.modName = source["modName"];
	        this.modUrl = source["modUrl"];
	        this.localDate = source["localDate"];
	        this.remoteDate = source["remoteDate"];
	    }
	}

}

export namespace utils {
	
	export class ZipFile {
	    name: string;
	    isDir: boolean;
	    path: string;
	    children?: ZipFile[];
	
	    static createFrom(source: any = {}) {
	        return new ZipFile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.isDir = source["isDir"];
	        this.path = source["path"];
	        this.children = this.convertValues(source["children"], ZipFile);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

