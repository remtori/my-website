
declare type LangKey = 'page.title' | 'page.description'

declare interface LangDef {
	en: LangKey;
	vn: LangKey;
}

declare interface LangJSON {
	defaultLang: keyof LangDef;
	lang: LangDef;
}
