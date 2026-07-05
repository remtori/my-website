export type OutputFormat = 'jpeg' | 'png' | 'webp' | 'avif' | 'heic' | 'jxl' | 'tiff' | 'gif' | 'ppm' | 'hdr' | 'uhdr' | 'raw' | 'csv';

export type ResizeMode = 'none' | 'fit' | 'fill' | 'exact' | 'scale';
export type CropMode = 'none' | 'manual' | 'smart' | 'trim';
export type RotateMode = 'none' | 'd90' | 'd180' | 'd270' | 'custom';

export type ImageToolOptions = {
	outputFormat: OutputFormat;
	buildFavicon: boolean;
	quality: number;
	effort: number;
	lossless: boolean;
	keepMetadata: boolean;
	progressive: boolean;
	autorotate: boolean;
	resizeMode: ResizeMode;
	width: number;
	height: number;
	scale: number;
	allowUpscale: boolean;
	kernel: string;
	cropMode: CropMode;
	cropLeft: number;
	cropTop: number;
	cropWidth: number;
	cropHeight: number;
	interesting: string;
	trimThreshold: number;
	rotateMode: RotateMode;
	customAngle: number;
	flipHorizontal: boolean;
	flipVertical: boolean;
	flatten: boolean;
	background: string;
	grayscale: boolean;
	invert: boolean;
	blur: number;
	sharpen: number;
	gamma: number;
	brightness: number;
	contrast: number;
	paletteSize: number;
};

export type MetadataEntry = {
	name: string;
	value: string;
};

export type ImageMetadata = {
	width: number;
	height: number;
	bands: number;
	format: string;
	coding: string;
	interpretation: string;
	hasAlpha: boolean;
	xres: number;
	yres: number;
	pageHeight: number;
	fields: MetadataEntry[];
};

export type WorkerOutput = {
	name: string;
	format: string;
	mime: string;
	size: number;
	buffer: ArrayBuffer;
};

export type WorkerPreview = {
	mime: 'image/png';
	buffer: ArrayBuffer;
};

export type WorkerRequest =
	| {
			type: 'process';
			id: string;
			fileName: string;
			mime: string;
			buffer: ArrayBuffer;
			options: ImageToolOptions;
	  }
	| {
			type: 'shutdown';
	  };

export type WorkerResponse =
	| {
			type: 'progress';
			id: string;
			stage: string;
			percent: number;
	  }
	| {
			type: 'result';
			id: string;
			input: ImageMetadata;
			output: ImageMetadata;
			outputs: WorkerOutput[];
			preview: WorkerPreview;
			engine: {
				vips: string;
				emscripten: string;
			};
	  }
	| {
			type: 'error';
			id: string;
			message: string;
	  };
