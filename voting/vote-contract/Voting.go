// Code generated - DO NOT EDIT.
// This file is a generated binding and any manual changes will be lost.

package voting

import (
	"errors"
	"math/big"
	"strings"

	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/event"
)

// Reference imports to suppress errors if they are not otherwise used.
var (
	_ = errors.New
	_ = big.NewInt
	_ = strings.NewReader
	_ = ethereum.NotFound
	_ = bind.Bind
	_ = common.Big1
	_ = types.BloomLookup
	_ = event.NewSubscription
	_ = abi.ConvertType
)

// VotingMetaData contains all meta data concerning the Voting contract.
var VotingMetaData = &bind.MetaData{
	ABI: "[{\"inputs\":[],\"name\":\"resetVotes\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"string\",\"name\":\"candidate\",\"type\":\"string\"}],\"name\":\"vote\",\"outputs\":[],\"stateMutability\":\"nonpayable\",\"type\":\"function\"},{\"anonymous\":false,\"inputs\":[{\"indexed\":false,\"internalType\":\"string\",\"name\":\"candidate\",\"type\":\"string\"},{\"indexed\":false,\"internalType\":\"uint256\",\"name\":\"newVoteCount\",\"type\":\"uint256\"}],\"name\":\"VoteCast\",\"type\":\"event\"},{\"anonymous\":false,\"inputs\":[],\"name\":\"VotesReset\",\"type\":\"event\"},{\"inputs\":[],\"name\":\"getAllCandidates\",\"outputs\":[{\"internalType\":\"string[]\",\"name\":\"\",\"type\":\"string[]\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[],\"name\":\"getCandidateCount\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"},{\"inputs\":[{\"internalType\":\"string\",\"name\":\"candidate\",\"type\":\"string\"}],\"name\":\"getVotes\",\"outputs\":[{\"internalType\":\"uint256\",\"name\":\"\",\"type\":\"uint256\"}],\"stateMutability\":\"view\",\"type\":\"function\"}]",
	Bin: "0x6080604052348015600e575f5ffd5b50610b9e8061001c5f395ff3fe608060405234801561000f575f5ffd5b5060043610610055575f3560e01c80632e6997fe1461005957806330a5634714610077578063805265e514610095578063b9830ff1146100c5578063fc36e15b146100cf575b5f5ffd5b6100616100eb565b60405161006e91906104ca565b60405180910390f35b61007f6101bf565b60405161008c9190610502565b60405180910390f35b6100af60048036038101906100aa9190610658565b6101cb565b6040516100bc9190610502565b60405180910390f35b6100cd6101f1565b005b6100e960048036038101906100e49190610658565b61027c565b005b60606001805480602002602001604051908101604052809291908181526020015f905b828210156101b6578382905f5260205f2001805461012b906106cc565b80601f0160208091040260200160405190810160405280929190818152602001828054610157906106cc565b80156101a25780601f10610179576101008083540402835291602001916101a2565b820191905f5260205f20905b81548152906001019060200180831161018557829003601f168201915b50505050508152602001906001019061010e565b50505050905090565b5f600180549050905090565b5f5f826040516101db9190610736565b9081526020016040518091039020549050919050565b5f5f90505b60018054905081101561024d575f5f600183815481106102195761021861074c565b5b905f5260205f200160405161022e919061080b565b90815260200160405180910390208190555080806001019150506101f6565b507f181116b640e6a324b012ab99d433f09debd8232185d611ebed62cfb16f06a4c460405160405180910390a1565b60028160405161028c9190610736565b90815260200160405180910390205f9054906101000a900460ff1661031457600181908060018154018082558091505060019003905f5260205f20015f9091909190915090816102dc91906109af565b5060016002826040516102ef9190610736565b90815260200160405180910390205f6101000a81548160ff0219169083151502179055505b5f816040516103239190610736565b90815260200160405180910390205f81548092919061034190610aab565b91905055507f777e12406713e556f995ae7467576ea751d01f243ff84668ef43b36634f3fa88815f836040516103779190610736565b908152602001604051809103902054604051610394929190610b3a565b60405180910390a150565b5f81519050919050565b5f82825260208201905092915050565b5f819050602082019050919050565b5f81519050919050565b5f82825260208201905092915050565b8281835e5f83830152505050565b5f601f19601f8301169050919050565b5f61040a826103c8565b61041481856103d2565b93506104248185602086016103e2565b61042d816103f0565b840191505092915050565b5f6104438383610400565b905092915050565b5f602082019050919050565b5f6104618261039f565b61046b81856103a9565b93508360208202850161047d856103b9565b805f5b858110156104b857848403895281516104998582610438565b94506104a48361044b565b925060208a01995050600181019050610480565b50829750879550505050505092915050565b5f6020820190508181035f8301526104e28184610457565b905092915050565b5f819050919050565b6104fc816104ea565b82525050565b5f6020820190506105155f8301846104f3565b92915050565b5f604051905090565b5f5ffd5b5f5ffd5b5f5ffd5b5f5ffd5b7f4e487b71000000000000000000000000000000000000000000000000000000005f52604160045260245ffd5b61056a826103f0565b810181811067ffffffffffffffff8211171561058957610588610534565b5b80604052505050565b5f61059b61051b565b90506105a78282610561565b919050565b5f67ffffffffffffffff8211156105c6576105c5610534565b5b6105cf826103f0565b9050602081019050919050565b828183375f83830152505050565b5f6105fc6105f7846105ac565b610592565b90508281526020810184848401111561061857610617610530565b5b6106238482856105dc565b509392505050565b5f82601f83011261063f5761063e61052c565b5b813561064f8482602086016105ea565b91505092915050565b5f6020828403121561066d5761066c610524565b5b5f82013567ffffffffffffffff81111561068a57610689610528565b5b6106968482850161062b565b91505092915050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52602260045260245ffd5b5f60028204905060018216806106e357607f821691505b6020821081036106f6576106f561069f565b5b50919050565b5f81905092915050565b5f610710826103c8565b61071a81856106fc565b935061072a8185602086016103e2565b80840191505092915050565b5f6107418284610706565b915081905092915050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52603260045260245ffd5b5f819050815f5260205f209050919050565b5f8154610797816106cc565b6107a181866106fc565b9450600182165f81146107bb57600181146107d057610802565b60ff1983168652811515820286019350610802565b6107d985610779565b5f5b838110156107fa578154818901526001820191506020810190506107db565b838801955050505b50505092915050565b5f610816828461078b565b915081905092915050565b5f6020601f8301049050919050565b5f82821b905092915050565b5f6008830261086b7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff82610830565b6108758683610830565b95508019841693508086168417925050509392505050565b5f819050919050565b5f6108b06108ab6108a6846104ea565b61088d565b6104ea565b9050919050565b5f819050919050565b6108c983610896565b6108dd6108d5826108b7565b84845461083c565b825550505050565b5f5f905090565b6108f46108e5565b6108ff8184846108c0565b505050565b5b81811015610922576109175f826108ec565b600181019050610905565b5050565b601f8211156109675761093881610779565b61094184610821565b81016020851015610950578190505b61096461095c85610821565b830182610904565b50505b505050565b5f82821c905092915050565b5f6109875f198460080261096c565b1980831691505092915050565b5f61099f8383610978565b9150826002028217905092915050565b6109b8826103c8565b67ffffffffffffffff8111156109d1576109d0610534565b5b6109db82546106cc565b6109e6828285610926565b5f60209050601f831160018114610a17575f8415610a05578287015190505b610a0f8582610994565b865550610a76565b601f198416610a2586610779565b5f5b82811015610a4c57848901518255600182019150602085019450602081019050610a27565b86831015610a695784890151610a65601f891682610978565b8355505b6001600288020188555050505b505050505050565b7f4e487b71000000000000000000000000000000000000000000000000000000005f52601160045260245ffd5b5f610ab5826104ea565b91507fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff8203610ae757610ae6610a7e565b5b600182019050919050565b5f82825260208201905092915050565b5f610b0c826103c8565b610b168185610af2565b9350610b268185602086016103e2565b610b2f816103f0565b840191505092915050565b5f6040820190508181035f830152610b528185610b02565b9050610b6160208301846104f3565b939250505056fea2646970667358221220b67d873f6789e9816224b031247bd37dbfa951534c1b46ea8c8f363a9c91d83864736f6c634300081e0033",
}

// VotingABI is the input ABI used to generate the binding from.
// Deprecated: Use VotingMetaData.ABI instead.
var VotingABI = VotingMetaData.ABI

// VotingBin is the compiled bytecode used for deploying new contracts.
// Deprecated: Use VotingMetaData.Bin instead.
var VotingBin = VotingMetaData.Bin

// DeployVoting deploys a new Ethereum contract, binding an instance of Voting to it.
func DeployVoting(auth *bind.TransactOpts, backend bind.ContractBackend) (common.Address, *types.Transaction, *Voting, error) {
	parsed, err := VotingMetaData.GetAbi()
	if err != nil {
		return common.Address{}, nil, nil, err
	}
	if parsed == nil {
		return common.Address{}, nil, nil, errors.New("GetABI returned nil")
	}

	address, tx, contract, err := bind.DeployContract(auth, *parsed, common.FromHex(VotingBin), backend)
	if err != nil {
		return common.Address{}, nil, nil, err
	}
	return address, tx, &Voting{VotingCaller: VotingCaller{contract: contract}, VotingTransactor: VotingTransactor{contract: contract}, VotingFilterer: VotingFilterer{contract: contract}}, nil
}

// Voting is an auto generated Go binding around an Ethereum contract.
type Voting struct {
	VotingCaller     // Read-only binding to the contract
	VotingTransactor // Write-only binding to the contract
	VotingFilterer   // Log filterer for contract events
}

// VotingCaller is an auto generated read-only Go binding around an Ethereum contract.
type VotingCaller struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// VotingTransactor is an auto generated write-only Go binding around an Ethereum contract.
type VotingTransactor struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// VotingFilterer is an auto generated log filtering Go binding around an Ethereum contract events.
type VotingFilterer struct {
	contract *bind.BoundContract // Generic contract wrapper for the low level calls
}

// VotingSession is an auto generated Go binding around an Ethereum contract,
// with pre-set call and transact options.
type VotingSession struct {
	Contract     *Voting           // Generic contract binding to set the session for
	CallOpts     bind.CallOpts     // Call options to use throughout this session
	TransactOpts bind.TransactOpts // Transaction auth options to use throughout this session
}

// VotingCallerSession is an auto generated read-only Go binding around an Ethereum contract,
// with pre-set call options.
type VotingCallerSession struct {
	Contract *VotingCaller // Generic contract caller binding to set the session for
	CallOpts bind.CallOpts // Call options to use throughout this session
}

// VotingTransactorSession is an auto generated write-only Go binding around an Ethereum contract,
// with pre-set transact options.
type VotingTransactorSession struct {
	Contract     *VotingTransactor // Generic contract transactor binding to set the session for
	TransactOpts bind.TransactOpts // Transaction auth options to use throughout this session
}

// VotingRaw is an auto generated low-level Go binding around an Ethereum contract.
type VotingRaw struct {
	Contract *Voting // Generic contract binding to access the raw methods on
}

// VotingCallerRaw is an auto generated low-level read-only Go binding around an Ethereum contract.
type VotingCallerRaw struct {
	Contract *VotingCaller // Generic read-only contract binding to access the raw methods on
}

// VotingTransactorRaw is an auto generated low-level write-only Go binding around an Ethereum contract.
type VotingTransactorRaw struct {
	Contract *VotingTransactor // Generic write-only contract binding to access the raw methods on
}

// NewVoting creates a new instance of Voting, bound to a specific deployed contract.
func NewVoting(address common.Address, backend bind.ContractBackend) (*Voting, error) {
	contract, err := bindVoting(address, backend, backend, backend)
	if err != nil {
		return nil, err
	}
	return &Voting{VotingCaller: VotingCaller{contract: contract}, VotingTransactor: VotingTransactor{contract: contract}, VotingFilterer: VotingFilterer{contract: contract}}, nil
}

// NewVotingCaller creates a new read-only instance of Voting, bound to a specific deployed contract.
func NewVotingCaller(address common.Address, caller bind.ContractCaller) (*VotingCaller, error) {
	contract, err := bindVoting(address, caller, nil, nil)
	if err != nil {
		return nil, err
	}
	return &VotingCaller{contract: contract}, nil
}

// NewVotingTransactor creates a new write-only instance of Voting, bound to a specific deployed contract.
func NewVotingTransactor(address common.Address, transactor bind.ContractTransactor) (*VotingTransactor, error) {
	contract, err := bindVoting(address, nil, transactor, nil)
	if err != nil {
		return nil, err
	}
	return &VotingTransactor{contract: contract}, nil
}

// NewVotingFilterer creates a new log filterer instance of Voting, bound to a specific deployed contract.
func NewVotingFilterer(address common.Address, filterer bind.ContractFilterer) (*VotingFilterer, error) {
	contract, err := bindVoting(address, nil, nil, filterer)
	if err != nil {
		return nil, err
	}
	return &VotingFilterer{contract: contract}, nil
}

// bindVoting binds a generic wrapper to an already deployed contract.
func bindVoting(address common.Address, caller bind.ContractCaller, transactor bind.ContractTransactor, filterer bind.ContractFilterer) (*bind.BoundContract, error) {
	parsed, err := VotingMetaData.GetAbi()
	if err != nil {
		return nil, err
	}
	return bind.NewBoundContract(address, *parsed, caller, transactor, filterer), nil
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_Voting *VotingRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _Voting.Contract.VotingCaller.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_Voting *VotingRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _Voting.Contract.VotingTransactor.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_Voting *VotingRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _Voting.Contract.VotingTransactor.contract.Transact(opts, method, params...)
}

// Call invokes the (constant) contract method with params as input values and
// sets the output to result. The result type might be a single field for simple
// returns, a slice of interfaces for anonymous returns and a struct for named
// returns.
func (_Voting *VotingCallerRaw) Call(opts *bind.CallOpts, result *[]interface{}, method string, params ...interface{}) error {
	return _Voting.Contract.contract.Call(opts, result, method, params...)
}

// Transfer initiates a plain transaction to move funds to the contract, calling
// its default method if one is available.
func (_Voting *VotingTransactorRaw) Transfer(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _Voting.Contract.contract.Transfer(opts)
}

// Transact invokes the (paid) contract method with params as input values.
func (_Voting *VotingTransactorRaw) Transact(opts *bind.TransactOpts, method string, params ...interface{}) (*types.Transaction, error) {
	return _Voting.Contract.contract.Transact(opts, method, params...)
}

// GetAllCandidates is a free data retrieval call binding the contract method 0x2e6997fe.
//
// Solidity: function getAllCandidates() view returns(string[])
func (_Voting *VotingCaller) GetAllCandidates(opts *bind.CallOpts) ([]string, error) {
	var out []interface{}
	err := _Voting.contract.Call(opts, &out, "getAllCandidates")

	if err != nil {
		return *new([]string), err
	}

	out0 := *abi.ConvertType(out[0], new([]string)).(*[]string)

	return out0, err

}

// GetAllCandidates is a free data retrieval call binding the contract method 0x2e6997fe.
//
// Solidity: function getAllCandidates() view returns(string[])
func (_Voting *VotingSession) GetAllCandidates() ([]string, error) {
	return _Voting.Contract.GetAllCandidates(&_Voting.CallOpts)
}

// GetAllCandidates is a free data retrieval call binding the contract method 0x2e6997fe.
//
// Solidity: function getAllCandidates() view returns(string[])
func (_Voting *VotingCallerSession) GetAllCandidates() ([]string, error) {
	return _Voting.Contract.GetAllCandidates(&_Voting.CallOpts)
}

// GetCandidateCount is a free data retrieval call binding the contract method 0x30a56347.
//
// Solidity: function getCandidateCount() view returns(uint256)
func (_Voting *VotingCaller) GetCandidateCount(opts *bind.CallOpts) (*big.Int, error) {
	var out []interface{}
	err := _Voting.contract.Call(opts, &out, "getCandidateCount")

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// GetCandidateCount is a free data retrieval call binding the contract method 0x30a56347.
//
// Solidity: function getCandidateCount() view returns(uint256)
func (_Voting *VotingSession) GetCandidateCount() (*big.Int, error) {
	return _Voting.Contract.GetCandidateCount(&_Voting.CallOpts)
}

// GetCandidateCount is a free data retrieval call binding the contract method 0x30a56347.
//
// Solidity: function getCandidateCount() view returns(uint256)
func (_Voting *VotingCallerSession) GetCandidateCount() (*big.Int, error) {
	return _Voting.Contract.GetCandidateCount(&_Voting.CallOpts)
}

// GetVotes is a free data retrieval call binding the contract method 0x805265e5.
//
// Solidity: function getVotes(string candidate) view returns(uint256)
func (_Voting *VotingCaller) GetVotes(opts *bind.CallOpts, candidate string) (*big.Int, error) {
	var out []interface{}
	err := _Voting.contract.Call(opts, &out, "getVotes", candidate)

	if err != nil {
		return *new(*big.Int), err
	}

	out0 := *abi.ConvertType(out[0], new(*big.Int)).(**big.Int)

	return out0, err

}

// GetVotes is a free data retrieval call binding the contract method 0x805265e5.
//
// Solidity: function getVotes(string candidate) view returns(uint256)
func (_Voting *VotingSession) GetVotes(candidate string) (*big.Int, error) {
	return _Voting.Contract.GetVotes(&_Voting.CallOpts, candidate)
}

// GetVotes is a free data retrieval call binding the contract method 0x805265e5.
//
// Solidity: function getVotes(string candidate) view returns(uint256)
func (_Voting *VotingCallerSession) GetVotes(candidate string) (*big.Int, error) {
	return _Voting.Contract.GetVotes(&_Voting.CallOpts, candidate)
}

// ResetVotes is a paid mutator transaction binding the contract method 0xb9830ff1.
//
// Solidity: function resetVotes() returns()
func (_Voting *VotingTransactor) ResetVotes(opts *bind.TransactOpts) (*types.Transaction, error) {
	return _Voting.contract.Transact(opts, "resetVotes")
}

// ResetVotes is a paid mutator transaction binding the contract method 0xb9830ff1.
//
// Solidity: function resetVotes() returns()
func (_Voting *VotingSession) ResetVotes() (*types.Transaction, error) {
	return _Voting.Contract.ResetVotes(&_Voting.TransactOpts)
}

// ResetVotes is a paid mutator transaction binding the contract method 0xb9830ff1.
//
// Solidity: function resetVotes() returns()
func (_Voting *VotingTransactorSession) ResetVotes() (*types.Transaction, error) {
	return _Voting.Contract.ResetVotes(&_Voting.TransactOpts)
}

// Vote is a paid mutator transaction binding the contract method 0xfc36e15b.
//
// Solidity: function vote(string candidate) returns()
func (_Voting *VotingTransactor) Vote(opts *bind.TransactOpts, candidate string) (*types.Transaction, error) {
	return _Voting.contract.Transact(opts, "vote", candidate)
}

// Vote is a paid mutator transaction binding the contract method 0xfc36e15b.
//
// Solidity: function vote(string candidate) returns()
func (_Voting *VotingSession) Vote(candidate string) (*types.Transaction, error) {
	return _Voting.Contract.Vote(&_Voting.TransactOpts, candidate)
}

// Vote is a paid mutator transaction binding the contract method 0xfc36e15b.
//
// Solidity: function vote(string candidate) returns()
func (_Voting *VotingTransactorSession) Vote(candidate string) (*types.Transaction, error) {
	return _Voting.Contract.Vote(&_Voting.TransactOpts, candidate)
}

// VotingVoteCastIterator is returned from FilterVoteCast and is used to iterate over the raw logs and unpacked data for VoteCast events raised by the Voting contract.
type VotingVoteCastIterator struct {
	Event *VotingVoteCast // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *VotingVoteCastIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(VotingVoteCast)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(VotingVoteCast)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *VotingVoteCastIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *VotingVoteCastIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// VotingVoteCast represents a VoteCast event raised by the Voting contract.
type VotingVoteCast struct {
	Candidate    string
	NewVoteCount *big.Int
	Raw          types.Log // Blockchain specific contextual infos
}

// FilterVoteCast is a free log retrieval operation binding the contract event 0x777e12406713e556f995ae7467576ea751d01f243ff84668ef43b36634f3fa88.
//
// Solidity: event VoteCast(string candidate, uint256 newVoteCount)
func (_Voting *VotingFilterer) FilterVoteCast(opts *bind.FilterOpts) (*VotingVoteCastIterator, error) {

	logs, sub, err := _Voting.contract.FilterLogs(opts, "VoteCast")
	if err != nil {
		return nil, err
	}
	return &VotingVoteCastIterator{contract: _Voting.contract, event: "VoteCast", logs: logs, sub: sub}, nil
}

// WatchVoteCast is a free log subscription operation binding the contract event 0x777e12406713e556f995ae7467576ea751d01f243ff84668ef43b36634f3fa88.
//
// Solidity: event VoteCast(string candidate, uint256 newVoteCount)
func (_Voting *VotingFilterer) WatchVoteCast(opts *bind.WatchOpts, sink chan<- *VotingVoteCast) (event.Subscription, error) {

	logs, sub, err := _Voting.contract.WatchLogs(opts, "VoteCast")
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(VotingVoteCast)
				if err := _Voting.contract.UnpackLog(event, "VoteCast", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseVoteCast is a log parse operation binding the contract event 0x777e12406713e556f995ae7467576ea751d01f243ff84668ef43b36634f3fa88.
//
// Solidity: event VoteCast(string candidate, uint256 newVoteCount)
func (_Voting *VotingFilterer) ParseVoteCast(log types.Log) (*VotingVoteCast, error) {
	event := new(VotingVoteCast)
	if err := _Voting.contract.UnpackLog(event, "VoteCast", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}

// VotingVotesResetIterator is returned from FilterVotesReset and is used to iterate over the raw logs and unpacked data for VotesReset events raised by the Voting contract.
type VotingVotesResetIterator struct {
	Event *VotingVotesReset // Event containing the contract specifics and raw log

	contract *bind.BoundContract // Generic contract to use for unpacking event data
	event    string              // Event name to use for unpacking event data

	logs chan types.Log        // Log channel receiving the found contract events
	sub  ethereum.Subscription // Subscription for errors, completion and termination
	done bool                  // Whether the subscription completed delivering logs
	fail error                 // Occurred error to stop iteration
}

// Next advances the iterator to the subsequent event, returning whether there
// are any more events found. In case of a retrieval or parsing error, false is
// returned and Error() can be queried for the exact failure.
func (it *VotingVotesResetIterator) Next() bool {
	// If the iterator failed, stop iterating
	if it.fail != nil {
		return false
	}
	// If the iterator completed, deliver directly whatever's available
	if it.done {
		select {
		case log := <-it.logs:
			it.Event = new(VotingVotesReset)
			if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
				it.fail = err
				return false
			}
			it.Event.Raw = log
			return true

		default:
			return false
		}
	}
	// Iterator still in progress, wait for either a data or an error event
	select {
	case log := <-it.logs:
		it.Event = new(VotingVotesReset)
		if err := it.contract.UnpackLog(it.Event, it.event, log); err != nil {
			it.fail = err
			return false
		}
		it.Event.Raw = log
		return true

	case err := <-it.sub.Err():
		it.done = true
		it.fail = err
		return it.Next()
	}
}

// Error returns any retrieval or parsing error occurred during filtering.
func (it *VotingVotesResetIterator) Error() error {
	return it.fail
}

// Close terminates the iteration process, releasing any pending underlying
// resources.
func (it *VotingVotesResetIterator) Close() error {
	it.sub.Unsubscribe()
	return nil
}

// VotingVotesReset represents a VotesReset event raised by the Voting contract.
type VotingVotesReset struct {
	Raw types.Log // Blockchain specific contextual infos
}

// FilterVotesReset is a free log retrieval operation binding the contract event 0x181116b640e6a324b012ab99d433f09debd8232185d611ebed62cfb16f06a4c4.
//
// Solidity: event VotesReset()
func (_Voting *VotingFilterer) FilterVotesReset(opts *bind.FilterOpts) (*VotingVotesResetIterator, error) {

	logs, sub, err := _Voting.contract.FilterLogs(opts, "VotesReset")
	if err != nil {
		return nil, err
	}
	return &VotingVotesResetIterator{contract: _Voting.contract, event: "VotesReset", logs: logs, sub: sub}, nil
}

// WatchVotesReset is a free log subscription operation binding the contract event 0x181116b640e6a324b012ab99d433f09debd8232185d611ebed62cfb16f06a4c4.
//
// Solidity: event VotesReset()
func (_Voting *VotingFilterer) WatchVotesReset(opts *bind.WatchOpts, sink chan<- *VotingVotesReset) (event.Subscription, error) {

	logs, sub, err := _Voting.contract.WatchLogs(opts, "VotesReset")
	if err != nil {
		return nil, err
	}
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case log := <-logs:
				// New log arrived, parse the event and forward to the user
				event := new(VotingVotesReset)
				if err := _Voting.contract.UnpackLog(event, "VotesReset", log); err != nil {
					return err
				}
				event.Raw = log

				select {
				case sink <- event:
				case err := <-sub.Err():
					return err
				case <-quit:
					return nil
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// ParseVotesReset is a log parse operation binding the contract event 0x181116b640e6a324b012ab99d433f09debd8232185d611ebed62cfb16f06a4c4.
//
// Solidity: event VotesReset()
func (_Voting *VotingFilterer) ParseVotesReset(log types.Log) (*VotingVotesReset, error) {
	event := new(VotingVotesReset)
	if err := _Voting.contract.UnpackLog(event, "VotesReset", log); err != nil {
		return nil, err
	}
	event.Raw = log
	return event, nil
}
