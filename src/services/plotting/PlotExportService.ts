import { Injectable } from '@angular/core';

@Injectable({
    providedIn: 'root'
})
export class PlotExportService {

    async exportPlotAsPNG(svgElement: SVGSVGElement, width: number, height: number, hostElement: HTMLElement, title?: string | null): Promise<void> {
        const hostComputedStyle = window.getComputedStyle(hostElement);
        const bgColor = hostComputedStyle.getPropertyValue('--background-color').trim() || hostComputedStyle.backgroundColor || 'white';

        const svgClone = svgElement.cloneNode(true) as SVGSVGElement;

        this.applyComputedStylesToElement(svgClone, hostElement);

        await this.convertImagesToDataUrls(svgClone);

        const canvas = await this.svgToCanvas(svgClone, width, height, bgColor, hostElement);

        canvas.toBlob(blob => {
            if (blob) {
                const pngUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = pngUrl;
                a.download = (title || 'plot') + '.png';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(pngUrl);
            }
        }, 'image/png');
    }

    private svgToCanvas(svgElement: SVGSVGElement, width: number, height: number, bgColor: string, contextElement: Element): Promise<HTMLCanvasElement> {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                reject(new Error('Could not get canvas context'));
                return;
            }

            ctx.fillStyle = this.hexToRgb(bgColor) || '#ffffff';
            ctx.fillRect(0, 0, width, height);

            this.replaceStyleVariablesInSvg(svgElement, contextElement);

            const serializer = new XMLSerializer();
            let svgString = serializer.serializeToString(svgElement);

            if (!svgString.startsWith('<?xml')) {
                svgString = '<?xml version="1.0" encoding="UTF-8"?>\n' + svgString;
            }

            const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            const img = new Image();

            img.onload = () => {
                ctx.drawImage(img, 0, 0, width, height);
                URL.revokeObjectURL(url);
                resolve(canvas);
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Failed to render SVG to canvas'));
            };

            setTimeout(() => {
                img.src = url;
            }, 0);
        });
    }

    private replaceStyleVariablesInSvg(svgElement: SVGSVGElement, contextElement: Element): void {
        const styles = svgElement.querySelectorAll('style');
        const cssVariables = this.getCssVariables(contextElement);

        styles.forEach(styleTag => {
            let cssText = styleTag.textContent || '';

            cssVariables.forEach(([varName, varValue]) => {
                const varRegex = new RegExp(`var\\(\\s*${varName}\\s*\\)`, 'g');
                cssText = cssText.replace(varRegex, varValue);
            });

            cssText = cssText.replace(/var\(--text-color\)/g, 'white');
            cssText = cssText.replace(/color:\s*var\([^)]*\)/g, 'color: white');
            cssText = cssText.replace(/fill:\s*var\([^)]*\)/g, 'fill: white');

            styleTag.textContent = cssText;
        });
    }

    private getCssVariables(element: Element): Array<[string, string]> {
        const variables: Array<[string, string]> = [];
        const computedStyle = window.getComputedStyle(element);

        const varNames = [
            '--text-color',
            '--background-color',
            '--lighter-background-color',
            '--faded-border-color',
            '--box-shadow',
            '--header-font-family',
            '--font-family'
        ];

        varNames.forEach(varName => {
            let value = computedStyle.getPropertyValue(varName).trim();

            if (!value) {
                let current = element.parentElement;
                while (current && !value) {
                    value = window.getComputedStyle(current).getPropertyValue(varName).trim();
                    current = current.parentElement;
                }
            }

            if (value) {
                variables.push([varName, value]);
            }
        });

        return variables;
    }

    private applyComputedStylesToElement(element: Element, contextElement: Element): Element {
        const walkElements = (el: Element) => {
            const computedStyle = window.getComputedStyle(el);
            const stylesToApply = [
                'color', 'fill', 'stroke', 'stroke-width', 'font-family',
                'font-size', 'font-weight', 'text-anchor', 'opacity', 'fill-opacity',
                'background-color', 'text-shadow'
            ];

            let inlineStyle = el.getAttribute('style') || '';

            stylesToApply.forEach(styleProp => {
                const value = computedStyle.getPropertyValue(styleProp);
                if (value && value.trim() && value !== 'auto' && value !== 'initial') {
                    const propRegex = new RegExp(`${styleProp}\\s*:\\s*[^;]*;?`, 'i');
                    inlineStyle = inlineStyle.replace(propRegex, '');
                    inlineStyle += `${styleProp}: ${value};`;
                }
            });

            const tagName = el.tagName.toLowerCase();
            if (tagName === 'text' || tagName === 'tspan') {
                inlineStyle = inlineStyle.replace(/fill\s*:\s*[^;]*;?/i, '');
                inlineStyle += 'fill: white;';
            }

            if (inlineStyle) {
                el.setAttribute('style', inlineStyle.trim());
            }

            Array.from(el.children).forEach(child => {
                walkElements(child);
            });
        };

        walkElements(element);
        return element;
    }

    private async convertImagesToDataUrls(svgElement: SVGSVGElement): Promise<void> {
        const images = svgElement.querySelectorAll('image');
        const promises: Promise<void>[] = [];

        images.forEach(imgElement => {
            const href = imgElement.getAttribute('href') || imgElement.getAttributeNS('http://www.w3.org/1999/xlink', 'href');

            if (href && !href.startsWith('data:')) {
                promises.push(
                    this.imageUrlToDataUrl(href).then(dataUrl => {
                        imgElement.setAttribute('href', dataUrl);
                        imgElement.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', dataUrl);
                    }).catch(err => {
                        console.warn(`Failed to convert image ${href}, will skip:`, err);
                    })
                );
            }
        });

        await Promise.all(promises);
    }

    private imageUrlToDataUrl(url: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const img = new Image();

            const timeout = setTimeout(() => {
                reject(new Error(`Image load timeout: ${url}`));
            }, 5000);

            img.onload = () => {
                clearTimeout(timeout);
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(img, 0, 0);
                        resolve(canvas.toDataURL('image/png'));
                    } else {
                        reject(new Error('Could not get canvas context'));
                    }
                } catch (err) {
                    reject(new Error(`Failed to convert image to data URL: ${err}`));
                }
            };

            img.onerror = () => {
                clearTimeout(timeout);
                reject(new Error(`Failed to load image: ${url}`));
            };

            img.src = url;
        });
    }

    private hexToRgb(color: string): string {
        if (color.startsWith('rgb')) {
            return color;
        }

        const hex = color.replace('#', '');
        if (hex.length === 6) {
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            return `rgb(${r}, ${g}, ${b})`;
        }

        return color;
    }
}
