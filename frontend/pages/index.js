import BuyMeACoffeeArtifact from '../contract/BuyMeACoffee.json';
import deployedContract from '../contract/deployed_addresses.json';
import { ethers } from "ethers";
import Head from 'next/head'
import React, { useState, useEffect, useRef} from "react";
import styles from '../styles/Home.module.css'

export default function Home() {
  // Contract Address & ABI
  const contractAddress = deployedContract.address;
  const contractABI = BuyMeACoffeeArtifact.abi;

  // Component state
  const [currentAccount, setCurrentAccount] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [transactionHash, setTransactionHash] = useState("");
  const [memos, setMemos] = useState([]);
  const [numberOfCoffees, setNumberOfCoffees] = useState(1)
  const [coffeePrice, setCoffeePrice] = useState(0.01);
  const SEPOLIA_NETWORK_ID = '11155111'
  //to prevent double pollDataInterval during connectWallet call due to event listener
  //accountsChanged
  const isPollingStarted = useRef(false);
  //always useRef for storing interavlID due to async nature of useState
  const pollDataInterval = useRef(null);

  useEffect(() => {
    const { ethereum } = window;

    if(!ethereum){
      alert("Please install EVM Wallet!");
      return;
    }

    const handleAccountsChanged = async ([newAddress]) => {
      stopPollingData();

      if(newAddress === undefined){
        setCurrentAccount("");
        console.log("Wallet disconnected")
        return;
      }

      console.log("address changed to: ", newAddress);
      setCurrentAccount(newAddress);
      startPollingData();
    }

    ethereum.on("accountsChanged", handleAccountsChanged);

    //removes event listener when component unmounts
    return () => {
      stopPollingData();
      ethereum.removeListener("accountsChanged", handleAccountsChanged)
    }
  }, [])

  const onNameChange = (event) => {
    setName(event.target.value);
  }

  const onMessageChange = (event) => {
    setMessage(event.target.value);
  }

  const handleCoffeeInputChange = (event) => {
    //check for integer
    if(event.target.value % 1 === 0){
    setCoffeePrice((event.target.value * 0.01).toFixed(3))
    setNumberOfCoffees(event.target.value)
    }
  }

  const connectWallet = async () => {
    console.log("connectWallet func is called");
    try {
      const { ethereum } = window;

      if (!ethereum) {
        alert("Please install EVM Wallet!");
        return;
      }

      const [userAddress] = await ethereum.request({ method: "eth_requestAccounts" });

      await checkNetwork();
      setCurrentAccount(userAddress);
      startPollingData();
    } catch (error) {
      if (error.code === 4001) {
        // User rejected the request
        console.log("User rejected the connect request");
        return;
      } else if (error.code === -32002) {
        // Request already pending
        alert("A connection request is already pending. Please check your MetaMask extension.");
        return;
      } else {
        console.error("An error occurred while connecting to the wallet:", error);
        return;
      }
    }
  }

  const disconnectWallet = async() => {
    stopPollingData();
    //disconnects all user connected wallets
    await window.ethereum.request({
      "method": "wallet_revokePermissions",
      "params": [
       {
         eth_accounts: {}
       }
     ],
     });
    setCurrentAccount('');
    setCoffeePrice(0.01);
    setNumberOfCoffees(1);
  }

  const withdrawContractEther = async () => {
    try {
      const {ethereum} = window;

      if(ethereum){
        const provider = new ethers.BrowserProvider(ethereum, "any");
        const signer = await provider.getSigner();
        const buyMeACoffee = new ethers.Contract(
          contractAddress,
          contractABI,
          signer
        );

        const withdrawalTxn = await buyMeACoffee.withdrawTips();
        await withdrawalTxn.wait();
      }
    } catch (error) {
        // Handle the error if the caller is not the owner
        if (error.code === "CALL_EXCEPTION") {
          window.alert("Only contract owner can withdraw");
        } else {
          console.log("Error :", error);
        }
    }
  }

  const buyCoffee = async () => {
    try {
      const { ethereum } = window;

      if (ethereum) {
        const provider = new ethers.BrowserProvider(ethereum, "any");
        const signer = await provider.getSigner();
        const buyMeACoffee = new ethers.Contract(
          contractAddress,
          contractABI,
          signer
        );

        // console.log("buying coffee..")
        const coffeeTxn = await buyMeACoffee.buyCoffee(
          name ? name : "anon",
          message ? message : "Enjoy your coffee!",
          { value: ethers.parseEther(`${coffeePrice}`) }
        );
        setTransactionHash(coffeeTxn.hash);

        await coffeeTxn.wait();

        // console.log("mined ", coffeTxn.hash);

        // console.log("coffee purchased!");

        // Clear the form fields.
        setName("");
        setMessage("");
        setTransactionHash("");
      }
    } catch (error) {
      console.log(error);
    }
  };

  // Function to fetch all memos stored on-chain.
  // ERROR: this func keeps getting called even after address is changed to undefined. WHY?
  const getMemos = async () => {
    console.log("Get memos called", pollDataInterval)
    try {
      const { ethereum } = window;

      if (ethereum) {
        const provider = new ethers.BrowserProvider(ethereum);
        const signer = await provider.getSigner();
        const buyMeACoffee = new ethers.Contract(
          contractAddress,
          contractABI,
          signer
        );

        //console.log("fetching memos from the blockchain..");
        const memos = await buyMeACoffee.getMemos();
        //console.log("fetched!");
        setMemos(memos);
      } else {
        console.log("Metamask is not connected");
      }

    } catch (error) {
      console.log(error);
    }
  };

  const startPollingData = () => {
    if(!isPollingStarted.current){
      getMemos();
      //console.log("start polling ", currentAccount);
      pollDataInterval.current = setInterval(() => getMemos(), 1000);
      //console.log(intervalID);
      //console.log("Polling Started");
      isPollingStarted.current = true;
    }
  }


  const stopPollingData = () => {
    if(isPollingStarted.current){
      clearInterval(pollDataInterval.current);
      pollDataInterval.current = null;
      //console.log("Polling stopped")
      isPollingStarted.current = false
    }
  }

  const checkNetwork = async() => {
    console.log('2._checkNetwork: checking network of our wallet');
    if (window.ethereum.networkVersion !== SEPOLIA_NETWORK_ID) {
      console.log("doesn not match then: Switching chain _switchChain");
      await switchChain();
    }
  }

  const switchChain = async() => {
    const chainIdHex = `0x${Number(SEPOLIA_NETWORK_ID).toString(16)}`
    console.log('3. _switchChain: ', chainIdHex);

    //switching to sepolia chain
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      });
    } catch (switchError) {
      console.error("Failed to switch chain: ", switchError);
    }
    console.log("4. Chain switched");
  }

  return (
    <div className={styles.container}>
      <Head>
        <title>Buy Arish a Coffee!</title>
        <meta name="description" content="Tipping site" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {currentAccount && (
      <button 
        className={styles.withdrawButton}
        onClick={withdrawContractEther}
      >
        Withdraw
      </button>
      )}

      {currentAccount && (
      <button 
        className={styles.disconnectButton}
        onClick={disconnectWallet}
      >
        Disconnect
      </button>
      )}

      <main className={styles.main}>
        <h1 className={styles.title}>
          Buy Arish a Coffee!
        </h1>

        {currentAccount ? ( transactionHash? (
          <div>buying coffee..</div>
        ) :
        (
          <div className={styles.formContainer}>
          <form className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="name">Name</label>
              <input
                id="name"
                type="text"
                placeholder="anon"
                onChange={onNameChange}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="message">Send Arish a message</label>
              <textarea
                rows={3}
                placeholder="Enjoy your coffee!"
                id="message"
                onChange={onMessageChange}
                required
              />
            </div>
            <div className={styles.formSubmit}>
              <button
                className={styles.button}
                type="button"
                onClick={buyCoffee}
              >
                Send <input 
                type="number" 
                min="1"
                value={numberOfCoffees}
                className={styles.numberInput} 
                onClick={
                  //stops button Onclick getting triggered
                  (event) => event.stopPropagation()
                }
                // onKeyDown={(event) => {
                //   // Prevent key presses from changing the input
                //   event.preventDefault();
                // }}
                onChange={handleCoffeeInputChange}
                /> Coffee for {coffeePrice}ETH
              </button>
            </div>
          </form>
        </div>
        )
        ) : (
          <button className={styles.button} onClick={connectWallet}> Connect your wallet </button>
        )}
      </main>

      {currentAccount && (<h1>Memos received</h1>)}

      {currentAccount && (
        <div className={styles.memoArea}>
          {memos.map((memo, idx) => {  
            const date = new Date(Number(memo.timestamp) * 1000);
            const formattedDate = date.toLocaleString();
            return(
              <div key={idx} className={styles.memoItem}>
                <p style={{ fontWeight: "bold" }}>{memo.message}</p>
                <p>From: {memo.name} at {formattedDate}</p>
              </div>
            )
          })}
        </div>
      )}

      <footer className={styles.footer}>
        <div>
          Created by <a href="https://x.com/flexwrapp" target="_blank">riceee</a>
        </div>
      </footer>
    </div>
  )
}
