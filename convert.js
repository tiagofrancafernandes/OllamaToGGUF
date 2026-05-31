const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ==========================================
// 1. SISTEMA DE MULTI-IDIOMA (i18n)
// ==========================================
const LOCALES = {
    'en': {
        'title': '--- Ollama To GGUF (Node.js) ---',
        'err_manifest': 'Error: Manifest directory not found at: %path%',
        'no_models': 'No models found.',
        'available_models': 'Available Ollama models:',
        'select_prompt': 'Enter model numbers separated by commas to convert (e.g. 1,3), "all" for all, or 0 to exit: ',
        'exiting': 'Exiting.',
        'invalid_choice': 'Invalid option selected.',
        'default_dir': 'Default directory: %path%',
        'path_prompt': 'Press ENTER for default or type a custom path: ',
        'export_start': 'Starting export to: %path%',
        'reading_layer': ' -> Reading Layer [%current%/%total%]: %type%',
        'err_blob': 'Crucial blob missing: %path%',
        'success': 'Success! Model exported perfectly.',
        'fail_recombine': 'Failed to recombine file: %msg%',
        'processing_model': '\nProcessing model: %name%',
        'quant_unknown': 'Unknown',
        'size_unknown': 'Unknown'
    },
    'pt': {
        'title': '--- Ollama To GGUF (Node.js) ---',
        'err_manifest': 'Erro: Diretório de manifestos não encontrado em: %path%',
        'no_models': 'Nenhum modelo encontrado.',
        'available_models': 'Modelos Ollama disponíveis:',
        'select_prompt': 'Digite os números dos modelos separados por vírgula (ex: 1,3), "all" para todos, ou 0 para sair: ',
        'exiting': 'Saindo.',
        'invalid_choice': 'Opção inválida selecionada.',
        'default_dir': 'Diretório padrão: %path%',
        'path_prompt': 'Pressione ENTER para o padrão ou digite um caminho personalizado: ',
        'export_start': 'Iniciando exportação para: %path%',
        'reading_layer': ' -> Lendo Camada [%current%/%total%]: %type%',
        'err_blob': 'Blob crucial ausente: %path%',
        'success': 'Sucesso! Modelo exportado perfeitamente.',
        'fail_recombine': 'Falha na recombinação do arquivo: %msg%',
        'processing_model': '\nProcessando modelo: %name%',
        'quant_unknown': 'Desconhecida',
        'size_unknown': 'Desconhecido'
    }
};

let currentLang = 'en'; // Padrão

function t(key, vars = {}) {
    const dict = LOCALES[currentLang] || LOCALES['en'];
    let text = dict[key] || LOCALES['en'][key] || key;
    for (const [vKey, vVal] of Object.entries(vars)) {
        text = text.replace(new RegExp(`%${vKey}%`, 'g'), vVal);
    }
    return text;
}

// ==========================================
// 2. CONFIGURAÇÕES E PARSE DE ARGUMENTOS
// ==========================================
const args = process.argv.slice(2).reduce((acc, arg) => {
    if (arg.startsWith('--')) {
        const [key, value] = arg.split('=');
        acc[key] = value !== undefined ? value : true;
    }
    return acc;
}, {});

// Definir Idioma (--lang=pt ou detecção automática do sistema)
if (args['--lang']) {
    currentLang = args['--lang'].split('-')[0].toLowerCase();
} else {
    const envLang = (process.env.LANG || process.env.LANGUAGE || 'en').split('_')[0].split('-')[0].toLowerCase();
    if (LOCALES[envLang]) currentLang = envLang;
}

// Configuração dos caminhos base do Ollama
const homeDir = process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH;
const manifestDir = path.join(homeDir, '.ollama', 'models', 'manifests', 'registry.ollama.ai');
const blobDir = path.join(homeDir, '.ollama', 'models', 'blobs');

// Pasta padrão de destino exigida conforme especificação técnica
const defaultOutputDir = args['--destination-base-dir']
    ? path.resolve(args['--destination-base-dir'])
    : path.join(__dirname, 'Ollama_Output_GGUF');

console.log(`\n${t('title')}\n`);

if (!fs.existsSync(manifestDir)) {
    console.error(t('err_manifest', { path: manifestDir }));
    process.exit(1);
}

// ==========================================
// 3. FUNÇÕES AUXILIARES DE ARQUIVOS
// ==========================================
function getManifestFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getManifestFiles(fullPath));
        } else {
            results.push(fullPath);
        }
    });
    return results;
}

function getModelSize(layers) {
    let totalSize = 0;
    layers.forEach((layer) => {
        if (!layer.digest) return;
        const sha = layer.digest.split(':')[1];
        const sourceBlob = path.join(blobDir, `sha256-${sha}`);
        if (fs.existsSync(sourceBlob)) {
            totalSize += fs.statSync(sourceBlob).size;
        }
    });
    return totalSize;
}

function processModelExport(model, baseOutputDir) {
    console.log(t('processing_model', { name: `${model.name}:${model.tag}` }));

    // Pasta estruturada com o mesmo nome do modelo dentro do destino
    const targetSubdir = path.join(baseOutputDir, model.name);
    if (!fs.existsSync(targetSubdir)) {
        fs.mkdirSync(targetSubdir, { recursive: true });
    }

    const finalFilename = `${model.name}-${model.trainedOn}-${model.quant}.gguf`.replace(/:/g, '_');
    const finalOutputPath = path.join(targetSubdir, finalFilename);

    console.log(t('export_start', { path: finalOutputPath }));

    try {
        const writeStream = fs.createWriteStream(finalOutputPath);

        for (let j = 0; j < model.layers.length; j++) {
            const layer = model.layers[j];
            const sha = layer.digest.split(':')[1];
            const sourceBlob = path.join(blobDir, `sha256-${sha}`);

            console.log(t('reading_layer', { current: j + 1, total: model.layers.length, type: layer.mediaType }));

            if (fs.existsSync(sourceBlob)) {
                const buffer = fs.readFileSync(sourceBlob);
                writeStream.write(buffer);
            } else {
                throw new Error(t('err_blob', { path: sourceBlob }));
            }
        }

        writeStream.end();
        console.log(t('success'));
    } catch (error) {
        console.error(t('fail_recombine', { msg: error.message }));
    }
}

// ==========================================
// 4. EXECUÇÃO PRINCIPAL
// ==========================================
async function main() {
    const manifestLocations = getManifestFiles(manifestDir);
    if (manifestLocations.length === 0) {
        console.log(t('no_models'));
        return;
    }

    let allLoadedModels = [];

    // Mapeamento e parse inicial de todos os modelos encontrados
    for (let i = 0; i < manifestLocations.length; i++) {
        const manifestPath = manifestLocations[i];
        const modelName = path.basename(path.dirname(manifestPath));
        const manifestFilename = path.basename(manifestPath);

        try {
            const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            const configDigest = manifestData.config?.digest?.split(':')[1];

            let modelQuant = t('quant_unknown');
            let trainedOn = 'unknown';

            if (configDigest) {
                const configFile = path.join(blobDir, `sha256-${configDigest}`);
                if (fs.existsSync(configFile)) {
                    const configData = JSON.parse(fs.readFileSync(configFile, 'utf8'));
                    modelQuant = configData.file_type || t('quant_unknown');
                    trainedOn = configData.model_type || 'unknown';
                }
            }

            const layers = manifestData.layers || [];
            const sizeInBytes = getModelSize(layers);
            const sizeStr = sizeInBytes > 0 ? `${(sizeInBytes / (1024 * 1024 * 1024)).toFixed(2)} GB` : t('size_unknown');

            // ID alternativo baseado na hash única do config digest do modelo
            const modelId = configDigest ? configDigest.substring(0, 12) : `idx-${i}`;

            allLoadedModels.push({
                id: modelId,
                name: modelName,
                tag: manifestFilename,
                fullName: `${modelName}:${manifestFilename}`,
                quant: modelQuant,
                trainedOn,
                layers,
                sizeStr
            });
        } catch (err) {
            // Ignorar manifestos corrompidos ou incompletos silenciosamente
        }
    }

    // Filtros de parâmetros CLI
    const hasExcept = args['--except-model-ids'] || args['--except-model-names'];
    const autoSelectAll = args['--all-models'] || hasExcept;

    let selectedModels = [];

    if (autoSelectAll) {
        // Presume carregar todos inicialmente
        selectedModels = [...allLoadedModels];

        // Aplica exclusões se existirem
        if (args['--except-model-ids']) {
            const exceptIds = args['--except-model-ids'].split(',');
            selectedModels = selectedModels.filter(m => !exceptIds.includes(m.id));
        }
        if (args['--except-model-names']) {
            const exceptNames = args['--except-model-names'].split(',');
            selectedModels = selectedModels.filter(m => !exceptNames.includes(m.name) && !exceptNames.includes(m.fullName));
        }
    } else if (args['--model-names']) {
        const targetNames = args['--model-names'].split(',');
        selectedModels = allLoadedModels.filter(m => targetNames.includes(m.name) || targetNames.includes(m.fullName));
    } else if (args['--model-ids']) {
        const targetIds = args['--model-ids'].split(',');
        selectedModels = allLoadedModels.filter(m => targetIds.includes(m.id));
    }

    // Se houver flags de seleção automática via CLI, executa direto sem menu interativo
    if (args['--all-models'] || args['--model-names'] || args['--model-ids'] || hasExcept) {


        selectedModels.forEach(model => processModelExport(model, defaultOutputDir));
        return;
    }
    // --- MENU INTERATIVO VIA TERMINAL ---
    console.log(`${t('available_models')}\n`);
    allLoadedModels.forEach((m, idx) => {
        console.log(`${idx + 1}. ${m.fullName} [ID: ${m.id}] (Quant: ${m.quant}, Size: ${m.sizeStr})`);
    });
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const question = (query) => new Promise((resolve) => rl.question(query, resolve));
    const choiceInput = await question(`\n${t('select_prompt')}`);
    const cleanInput = choiceInput.trim().toLowerCase();
    if (cleanInput === '0' || cleanInput === '') {
        console.log(t('exiting'));
        rl.close();
        return;
    }
    if (cleanInput === 'all') {
        selectedModels = [...allLoadedModels];
    } else {
        const indices = cleanInput.split(',').map(x => parseInt(x.trim(), 10) - 1);
        indices.forEach(idx => {
            if (allLoadedModels[idx]) {
                selectedModels.push(allLoadedModels[idx]);
            }
        });
    }
    if (selectedModels.length === 0) {
        console.log(t('invalid_choice'));
        rl.close();
        return;
    }
    console.log(`\n${t('default_dir', { path: defaultOutputDir })}`);
    const customPath = await question(t('path_prompt'));
    const finalOutputDir = customPath.trim() !== '' ? path.resolve(customPath.trim()) : defaultOutputDir;
    selectedModels.forEach(model => processModelExport(model, finalOutputDir));
    rl.close();
}
main();
