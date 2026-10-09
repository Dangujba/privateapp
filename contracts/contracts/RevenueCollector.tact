import "@stdlib/deploy";

const MIN_GAS: Int = ton("0.08");

message(0x70617972) PayRevenue {
    queryId: Int as uint64;
    referenceHash: Int as uint256;
    amountKobo: Int as uint64;
    exchangeRateKobo: Int as uint64;
    validUntil: Int as uint32;
    metadata: Cell;
}

message RevenueRecord {
    referenceHash: Int as uint256;
    amountKobo: Int as uint64;
}

message UpdateExchangeRate {
    rateKobo: Int as uint64;
}

message SetPaused {
    paused: Bool;
}

contract RevenueCollector with Deployable {
    owner: Address;
    governmentWallet: Address;
    exchangeRateKobo: Int as uint64;
    paused: Bool;
    transactionCount: Int as uint64;
    totalRevenueKobo: Int as uint128;
    totalCollectedNanoton: Int as coins;
    processedReferences: map<Int as uint256, Bool>;

    init(owner: Address, governmentWallet: Address, exchangeRateKobo: Int) {
        require(exchangeRateKobo > 0, "Invalid exchange rate");
        self.owner = owner;
        self.governmentWallet = governmentWallet;
        self.exchangeRateKobo = exchangeRateKobo;
        self.paused = false;
        self.transactionCount = 0;
        self.totalRevenueKobo = 0;
        self.totalCollectedNanoton = 0;
        self.processedReferences = emptyMap();
    }

    receive(msg: PayRevenue) {
        require(!self.paused, "Contract is paused");
        require(now() <= msg.validUntil, "Payment expired");
        require(self.processedReferences.get(msg.referenceHash) == null, "Duplicate reference");
        require(msg.exchangeRateKobo == self.exchangeRateKobo, "Incorrect exchange rate");
        require(msg.amountKobo >= 10000, "Below minimum");

        let amountNanoton: Int = (msg.amountKobo * 1000000000 + self.exchangeRateKobo / 2) / self.exchangeRateKobo;
        require(context().value >= amountNanoton + MIN_GAS, "Insufficient TON value");

        self.processedReferences.set(msg.referenceHash, true);
        self.transactionCount += 1;
        self.totalRevenueKobo += msg.amountKobo;
        self.totalCollectedNanoton += amountNanoton;

        send(SendParameters {
            to: self.governmentWallet,
            value: amountNanoton,
            mode: SendPayGasSeparately,
            bounce: true,
            body: RevenueRecord { referenceHash: msg.referenceHash, amountKobo: msg.amountKobo }.toCell()
        });
        send(SendParameters {
            to: sender(),
            value: 0,
            mode: SendRemainingValue | SendIgnoreErrors,
            bounce: false
        });
    }

    receive(msg: UpdateExchangeRate) {
        self.requireOwner();
        require(msg.rateKobo > 0, "Invalid exchange rate");
        let difference: Int = msg.rateKobo > self.exchangeRateKobo
            ? msg.rateKobo - self.exchangeRateKobo
            : self.exchangeRateKobo - msg.rateKobo;
        require(difference * 100 <= self.exchangeRateKobo * 20, "Rate change exceeds 20 percent");
        self.exchangeRateKobo = msg.rateKobo;
    }

    receive(msg: SetPaused) {
        self.requireOwner();
        self.paused = msg.paused;
    }

    fun requireOwner() {
        require(sender() == self.owner, "Owner only");
    }

    get fun getOwner(): Address { return self.owner; }
    get fun getGovernmentWallet(): Address { return self.governmentWallet; }
    get fun getCurrentExchangeRate(): Int { return self.exchangeRateKobo; }
    get fun getTransactionCount(): Int { return self.transactionCount; }
    get fun getTotalRevenueKobo(): Int { return self.totalRevenueKobo; }
    get fun getTotalCollected(): Int { return self.totalCollectedNanoton; }
    get fun getIsPaused(): Bool { return self.paused; }
    get fun isReferenceProcessed(referenceHash: Int): Bool { return self.processedReferences.get(referenceHash) != null; }
}
