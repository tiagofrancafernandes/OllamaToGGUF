# Ollama To GGUF (Node.js Edition)

An interactive, lightweight Node.js utility designed to extract, reconstruct, and export downloaded Ollama local models back into standard single-file GGUF formats. 

## Author

**Tiago França**
- **Website:** [tiagofranca.com](https://tiagofranca.com)
- **GitHub:** [@tiagofrancafernandes](https://github.com/tiagofrancafernandes)
- **LinkedIn:** [linkedin.com/in/tiago-php](https://linkedin.com/in/tiago-php)

## Overview

Ollama natively slices LLM weight layers and metadata configurations across scattered cache fragments called *blobs*. This utility automates the local scanning of your Ollama system directories, tracks down the exact manifest files, decodes model configurations (like quantization methods and base architectures), and sequentially merges the byte streams back into an uncorrupted, portable `.gguf` file ready for use in LM Studio, Llama.cpp, or KoboldCPP.

## Features

- ⚡ **Zero Dependencies**: Built entirely using native Node.js Core Modules (`fs`, `path`, `readline`). No external NPM packages or installations required.
- 🧠 **Memory Efficient**: Streams file data sequentially through node memory buffers to safely handle massive model variants (8B, 14B, 32B+) without crashing your RAM.
- 🎛️ **Interactive CLI Menu**: Dynamically fetches and lists all your locally downloaded Ollama models with their exact sizes and quantization footprints.
- 📂 **Flexible Destination**: Lets you choose between exporting to a default script-relative `Output/` directory or entering a custom path on your system.

## Requirements

- **Minimum Node.js Version**: `v16.0.0` (Required for modern filesystem flags and promise APIs).
- **Recommended Node.js Version**: `v20.0.0` or higher (Optimized stream handling and performance updates).
- **Local Filesystem Access**: Must be run on a system where Ollama has downloaded local models to its default directory path (`~/.ollama/models/`).

## Setup

1. **Clone the Repository**:
   ```bash
   git clone https://github.com
   cd OllamaToGGUF-Node
   ```

2. **Verify Setup**:
   Ensure you have your Node.js runtime ready by running:
   ```bash
   node --version
   ```

## Usage

1. **Run the Script**:
   ```bash
   node convert.js
   ```

2. **Select a Model**:
   The interactive command-line application will list all models sitting in your Ollama cache directory. Type the numeric index corresponding to your target model and press **Enter**.

3. **Specify Export Path**:
   Press **Enter** to instantly write to the local `./Output` subdirectory, or write/paste an absolute path to a specific destination folder.

4. **Exit**:
   Enter `0` at the model selection prompt to cancel out and exit.

## Default Directory Map Checked

- **Linux / macOS**: `~/.ollama/models/manifests/registry.ollama.ai/` & `~/.ollama/models/blobs/`
- **Windows**: `C:\Users\<User>\.ollama\models\`

## Example Execution

```bash
\$ node convert.js

--- Ollama To GGUF (Node.js) ---

Modelos Ollama disponíveis para conversão:

1. llama3:8b (Quantização: Q4_K_M, Tamanho: 4.66 GB)
2. phi3:latest (Quantização: Q4_K_M, Tamanho: 2.18 GB)

Digite o número do modelo que deseja converter (or 0 para sair): 1

Diretório padrão: /home/tiago/projects/OllamaToGGUF-Node/Output
Pressione ENTER para o padrão ou digite um caminho personalizado: 

Iniciando exportação para: /home/tiago/projects/OllamaToGGUF-Node/Output/llama3/llama3-llama-Q4_K_M.gguf
 -> Lendo Camada [1/4]: application/vnd.ollama.image.model
 -> Lendo Camada [2/4]: application/vnd.ollama.image.license
 -> Lendo Camada [3/4]: application/vnd.ollama.image.template
 -> Lendo Camada [4/4]: application/vnd.ollama.image.params

Sucesso! Modelo exportado perfeitamente.
```

## Contributing

Contributions make the open-source community an amazing place to learn and create. Feel free to open issues, request edge-case features, or submit pull requests with code modifications.

## License

This project is open-source software available under the [MIT License](LICENSE).
