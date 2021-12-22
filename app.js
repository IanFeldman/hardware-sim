var sim;
var ticks;
var placeMode = false;
var nodes = [];
var emptyChar = ".";
var flashEmptyChar = ":";
var flashInterval = 20;
var cannotPlaceChar = "x";

/*
 ====================================================================================================
    LOOP
 ====================================================================================================
*/

async function RunLoop() {
    sim = new Simulation(50, 50, 50);
    ticks = 0;
    
    while (true) {
        UpdateSpinner();
        UpdateField();
        await new Promise(r => setTimeout(r, sim.updateInterval));
        ticks += 1;
    }
}

class Simulation {
    constructor(width, height, updateInterval) {
        this.width = width;
        this.height = height;
        this.updateInterval = updateInterval;
        // construct grid
        this.grid = [];
        for (let j = 0; j < this.height; j++) {
            let newRow = [];
            for (let i = 0; i < this.width; i++) {
                newRow.push(emptyChar);
            }
            this.grid.push(newRow);
        }
    }
}

function UpdateSpinner()  {
    let spinner = document.getElementById("spinner");
    let spinChar = ">";
    switch(ticks % 4) {
        case 0:
            spinChar += "|";
            break;
        case 1:
            spinChar += "/";
            break;
        case 2:
            spinChar += "&mdash;";
            break;
        case 3:
            spinChar += "\\";
            break;
    }
    spinner.innerHTML = spinChar;
}

function UpdateField() {
    // create temp grid that clones sim.grid
    let tempGrid = [];
    for (let i = 0; i < sim.grid.length; i++)
        tempGrid[i] = sim.grid[i].slice();
    
    // add proposed node location to temp grid
    if (placeMode) {
        let currNode = nodes[nodes.length - 1];                         // most recent node
        for (let j = 0; j < currNode.height; j++) {                     // loop over node height
            let rowToChange = currNode.y + j;                           // rows to change will be node pos.y + (0 to height-1)
            for (let i = 0; i < currNode.width; i++) {                  // loop over node width
                let columnToChange = currNode.x + i;                    // column to change will be node pos.x + (0 to width-1)
                let nodeChar = currNode.shape[j * currNode.width + i];  // char to put there
                if (tempGrid[rowToChange][columnToChange] != emptyChar) // if there is a node there, indicate w 'x'
                    tempGrid[rowToChange][columnToChange] = cannotPlaceChar;
                else
                    tempGrid[rowToChange][columnToChange] = nodeChar;       // add to temp grid
            }
        }
    }
    
    let gridText = "";
    let char = "";
    for (row of tempGrid) {
        for (point of row) {
            char = point;
            // flash empty points
            if (placeMode) {
                if (ticks % flashInterval < flashInterval / 2 && char == emptyChar)
                    char = flashEmptyChar;
            }
            // add to text
            gridText += char + " ";
        }
        gridText += "\n";
    }

    // update field html
    let field = document.getElementById("field");
    field.innerHTML = gridText;
}

/*
 ====================================================================================================
    USER INPUT
 ====================================================================================================
*/

document.addEventListener('keydown', function(event) {
    if (!placeMode)
        return;
    
    let currNode = nodes[nodes.length - 1];
    let xPos = currNode.x;
    let yPos = currNode.y;
    let width = currNode.width;
    let height = currNode.height;
    
    switch (event.keyCode) {
        case 65: // left
            if (CanMove(xPos - 1, yPos, width, height))
                currNode.x -= 1;
            break;
        case 68: // right
            if (CanMove(xPos + 1, yPos, width, height))
                currNode.x += 1;
            break;
        case 87: // up
            if (CanMove(xPos, yPos - 1, width, height))
                currNode.y -= 1;
            break;
        case 83: // down
            if (CanMove(xPos, yPos + 1, width, height))
                currNode.y += 1;
            break;
        case 13: // enter
            PlaceNode();
            break;
        case 8:  // del
            CancelPlace();
            break;
    }
});

// check if node is in bounds
function CanMove(x, y, w, h) {
    if (x < 0)
        return false;
    if (x + w - 1 >= sim.width)
        return false;
    if (y < 0)
        return false;
    if (y + h - 1 >= sim.height)
        return false;
    
    return true;
}

function PlaceNode() {
    let rowsToChange = [];
    let columnsToChange = [];
    let charsToPlace = [];
    
    // loop through first, checking if any point overlaps with another node
    // also add all points to the arrays
    let currNode = nodes[nodes.length - 1];                             // most recent node
    for (let j = 0; j < currNode.height; j++) {                         // loop over node height
        let rowToChange = currNode.y + j;                               // rows to change will be node pos.y + (0 to height-1)
        for (let i = 0; i < currNode.width; i++) {                      // loop over node width
            let columnToChange = currNode.x + i;                        // column to change will be node pos.x + (0 to width-1)
            let nodeChar = currNode.shape[j * currNode.width + i];      // char to put there
            if (sim.grid[rowToChange][columnToChange] != emptyChar) {   // if there is a node there, cannot place
                Debug("Error: cannot place on top of other node");
                return;
            }
            else {
                rowsToChange.push(rowToChange);
                columnsToChange.push(columnToChange);
                charsToPlace.push(nodeChar);
            }
        }
    }
    
    // update grid
    for (let i = 0; i < charsToPlace.length; i++) {
        sim.grid[rowsToChange[i]][columnsToChange[i]] = charsToPlace[i];
    }
    // exit place mode
    placeMode = false;
    
    Debug("Node placed");
}

function CancelPlace() {
    // remove added node from nodes
    nodes.pop();
    // exit place mode
    placeMode = false;
    
    Debug("Action canceled");
}

/*
 ====================================================================================================
    NODES
 ====================================================================================================
*/

class Node {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.width = 3;
        this.height = 3;
        this.shape  = "ooo"
        this.shape += "oNo"
        this.shape += "ooo"
    }
}

class Input extends Node {
    constructor(outAddress) {
        super(0, 1, 3, 3);
        this.outAddress = outAddress;
        this.output = 0;
    }
    Toggle() {
        // flip from 0 to 1 and vice versa
        this.output = 1 - this.output;
        this.CalcText();
    }
    CalcText() {
        this.text = "[out(" + this.outAddress + "):" + this.output + "]"
    }
}

class And extends Node {
    constructor(inAddress1, inAddress2, outAddress) {
        super(2, 1);
        this.inAddress1 = inAddress1;
        this.inAddress2 = inAddress2;
        this.outAddress = outAddress;
    }
    
}

/*
 ====================================================================================================
    FUNCTIONALITY
 ====================================================================================================
*/

function Debug(text) {
    let debug = document.getElementById("debug");
    debug.innerHTML = text;
}

function AddNode() {
    /*
    let nodeName = document.getElementById("nodeSelect").value;
    
    var newNode;
    switch (nodeName) {
        case "INPUT":
            let outAddress = prompt("Output address?");
            newNode = new Input(outAddress);
            break;
        case "AND":
            let inAddress1 = prompt("Input address 1?");
            let inAddress2 = prompt("Input address 2?");
            let outAddress = prompt("Output address?");
            newNode = new Input(inAddress1, inAddress2, outAddress);
            break;
    }
     */
    // cannot add a new node while already placing one
    if (placeMode) {
        Debug("Error: cannot add new node while in place mode");
        return;
    }
    
    let newNode = new Node();
    nodes.push(newNode);
    placeMode = true;
    
    Debug("Placing new node");
}
