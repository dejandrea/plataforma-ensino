export type PresentationDeck={schemaVersion:1;title:string;slides:Record<string,unknown>[]};
export type PresentationFile={path:string;mime:string;size:number;sha256:string};
export type ParsedPresentation={deck:PresentationDeck;files:(PresentationFile&{data:Uint8Array;kind:'deck'|'image'|'credits';sourcePath:string})[];warnings:string[];packageHash:string;slideCount:number};
export type PresentationBundle={deck:PresentationDeck;assets:Record<string,string>;versionKey:string;assetOrigin?:string};
export type PresentationVersion={id:string;presentation_id:string;version_number:number;title:string;package_hash:string;files:PresentationFile[];warnings:string[];slide_count:number;created_at:string};
export type ManagedPresentation={id:string;lesson_id:string;title:string;active_version_id:string|null;versions:PresentationVersion[]};
export type PresentationActivity={id:string;key:string;title:string;publication_status:string;resource_url:string|null;presentation_id:string|null};
export type PresentationState={presentations:ManagedPresentation[];activities:PresentationActivity[]};
