export namespace backend {
	
	export class Settings {
	    theme: string;
	    notificationMode: string;
	    notificationCooldown: number;
	    refreshInterval: number;
	
	    static createFrom(source: any = {}) {
	        return new Settings(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.theme = source["theme"];
	        this.notificationMode = source["notificationMode"];
	        this.notificationCooldown = source["notificationCooldown"];
	        this.refreshInterval = source["refreshInterval"];
	    }
	}

}

export namespace main {
	
	export class ServerStatus {
	    is_up: boolean;
	    response_time_ms: number;
	    last_check: time.Time;
	    last_error?: string;
	
	    static createFrom(source: any = {}) {
	        return new ServerStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.is_up = source["is_up"];
	        this.response_time_ms = source["response_time_ms"];
	        this.last_check = this.convertValues(source["last_check"], time.Time);
	        this.last_error = source["last_error"];
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
	export class Server {
	    id: string;
	    name: string;
	    url: string;
	    type: string;
	    interval: string;
	    timeout: string;
	    status: ServerStatus;
	
	    static createFrom(source: any = {}) {
	        return new Server(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.url = source["url"];
	        this.type = source["type"];
	        this.interval = source["interval"];
	        this.timeout = source["timeout"];
	        this.status = this.convertValues(source["status"], ServerStatus);
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

export namespace time {
	
	export class Time {
	
	
	    static createFrom(source: any = {}) {
	        return new Time(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	
	    }
	}

}

