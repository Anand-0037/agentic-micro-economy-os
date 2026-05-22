from web3 import Web3
import os
from dotenv import load_dotenv

load_dotenv()

rpc_url = os.getenv("MANTLE_RPC_URL", "https://rpc.sepolia.mantle.xyz")
private_key = os.getenv("AGENT_PRIVATE_KEY")
treasury_eoa = os.getenv("TREASURY_EOA")

if not private_key.startswith("0x"):
    private_key = "0x" + private_key

w3 = Web3(Web3.HTTPProvider(rpc_url))

account = w3.eth.account.from_key(private_key)
from_address = account.address

print(f"From Address: {from_address}")
print(f"Treasury EOA: {treasury_eoa}")

balance_from = w3.eth.get_balance(from_address)
balance_to = w3.eth.get_balance(treasury_eoa)

print(f"Balance From: {w3.from_wei(balance_from, 'ether')} MNT")
print(f"Balance To: {w3.from_wei(balance_to, 'ether')} MNT")

if balance_from > 0:
    # Send 2 MNT (or whatever is there, leaving some for gas)
    # The user said "now there are two mnt", so I'll send 2 MNT if possible.
    amount_to_send = w3.to_wei(2, 'ether')
    
    if balance_from < amount_to_send:
        amount_to_send = balance_from - w3.to_wei(0.01, 'ether') # leave 0.01 for gas
        if amount_to_send < 0:
            print("Not enough balance for gas.")
            exit()

    nonce = w3.eth.get_transaction_count(from_address)
    
    tx = {
        'nonce': nonce,
        'to': treasury_eoa,
        'value': amount_to_send,
        'gas': 21000,
        'gasPrice': w3.eth.gas_price,
        'chainId': 5003
    }
    
    signed_tx = w3.eth.account.sign_transaction(tx, private_key)
    tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
    print(f"Transaction sent: {w3.to_hex(tx_hash)}")
else:
    print("No balance to send.")
