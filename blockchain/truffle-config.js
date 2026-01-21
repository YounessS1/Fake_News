module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",
      port: 7545, // Ganache GUI par défaut
      network_id: "*",
      // gas: 8000000,
    },
  },

  mocha: {
    // timeout: 100000
  },

  compilers: {
    solc: {
      version: "0.8.21",
      settings: {
        optimizer: { enabled: true, runs: 200 },
        evmVersion: "paris", // IMPORTANT: évite PUSH0 (Shanghai)
      },
    },
  },
};
