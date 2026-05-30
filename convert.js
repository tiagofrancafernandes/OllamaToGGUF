const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuração dos caminhos base
const homeDir = process.env.HOME || process.env.USERPROFILE || process.env.HOMEPATH;
const manifestDir = path.join(homeDir, '.ollama', 'models', 'manifests', 'registry.ollama.ai');
const blobDir = path.join(homeDir, '.ollama', 'models', 'blobs');
const defaultOutputDir = path.join(__dirname, 'Output');

console.log('\n--- Ollama To GGUF (Node.js) ---\n');

// Garante que a pasta de manifesto existe
if (!fs.existsSync(manifestDir)) {
    console.error(`Erro: Diretório de manifestos não encontrado em: ${manifestDir}`);
    process.exit(1);
}

// Função para escanear recursivamente os manifestos
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

const manifestLocations = getManifestFiles(manifestDir);

// Calcula tamanho somando os blobs das camadas
function getModelSize(layers) {
    let totalSize = 0;
    layers.forEach((layer) => {
        const sha = layer.digest.split(':')[1];
        const sourceBlob = path.join(blobDir, `sha256-${sha}`);
        if (fs.existsSync(sourceBlob)) {
            totalSize += fs.statSync(sourceBlob).size;
        }
    });
    return totalSize;
}

// Cria interface de input no terminal
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function main() {
    if (manifestLocations.length === 0) {
        console.log('Nenhum modelo encontrado.');
        rl.close();
        return;
    }

    const modelsList = [];

    console.log('Modelos Ollama disponíveis para conversão:\n');
    
    for (let i = 0; i < manifestLocations.length; i++) {
        const manifestPath = manifestLocations[i];
        const modelName = path.basename(path.dirname(manifestPath));
        const manifestFilename = path.basename(manifestPath);

        try {
            const manifestData = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            const configDigest = manifestData.config?.digest?.split(':')[1];
            
            let modelQuant = 'Desconhecida';
            let trainedOn = 'unknown';

            if (configDigest) {
                const configFile = path.join(blobDir, `sha256-${configDigest}`);
                if (fs.existsSync(configFile)) {
                    const configData = JSON.parse(fs.readFileSync(configFile, 'utf8'));
                    modelQuant = configData.file_type || 'Desconhecida';
                    trainedOn = configData.model_type || 'unknown';
                }
            }

            const layers = manifestData.layers || [];
            const sizeInBytes = getModelSize(layers);
            const sizeStr = sizeInBytes > 0 ? `${(sizeInBytes / (1024 * 1024)).toFixed(2)} MB` : 'Desconhecido';

            modelsList.push({
                index: i + 1,
                name: modelName,
                tag: manifestFilename,
                manifestPath,
                quant: modelQuant,
                trainedOn,
                layers,
                sizeStr
            });

            console.log(`${i + 1}. ${modelName}:${manifestFilename} (Quantização: ${modelQuant}, Tamanho: ${sizeStr})`);
        } catch (err) {
            console.log(`${i + 1}. ${modelName} (Erro ao ler manifesto)`);
        }
    }

    // Seleção do modelo
    const choiceInput = await question('\nDigite o número do modelo que deseja converter (ou 0 para sair): ');
    const choice = parseInt(choiceInput, 10);

    if (choice === 0 || isNaN(choice) || choice > modelsList.length) {
        console.log('Saindo.');
        rl.close();
        return;
    }

    const selectedModel = modelsList[choice - 1];

    // Seleção do destino
    console.log(`\nDiretório padrão: ${defaultOutputDir}`);
    const customPath = await question('Pressione ENTER para o padrão ou digite um caminho personalizado: ');
    const outputDir = customPath.trim() !== '' ? path.resolve(customPath.trim()) : defaultOutputDir;

    // Garante criação da pasta de destino
    const targetSubdir = path.join(outputDir, selectedModel.name);
    if (!fs.existsSync(targetSubdir)) {
        fs.mkdirSync(targetSubdir, { recursive: true });
    }

    const finalFilename = `${selectedModel.name}-${selectedModel.trainedOn}-${selectedModel.quant}.gguf`.replace(/:/g, '_');
    const finalOutputPath = path.join(targetSubdir, finalFilename);

    console.log(`\nIniciando exportação para: ${finalOutputPath}`);

    try {
        // Abre o arquivo de saída como escrita em stream
        const writeStream = fs.createWriteStream(finalOutputPath);

        for (let j = 0; j < selectedModel.layers.length; j++) {
            const layer = selectedModel.layers[j];
            const sha = layer.digest.split(':')[1];
            const sourceBlob = path.join(blobDir, `sha256-${sha}`);

            console.log(` -> Lendo Camada [${j + 1}/${selectedModel.layers.length}]: ${layer.mediaType}`);
            
            if (fs.existsSync(sourceBlob)) {
                // Lê o bloco atual e injeta direto no arquivo final sequencialmente
                const buffer = fs.readFileSync(sourceBlob);
                writeStream.write(buffer);
            } else {
                throw new Error(`Blob crucial ausente: ${sourceBlob}`);
            }
        }

        writeStream.end();
        console.log(`\nSucesso! Modelo exportado perfeitamente.`);
    } catch (error) {
        console.error(`\nFalha na recombinação do arquivo: ${error.message}`);
    }

    rl.close();
}

main();
