var sim;
var ticks;
var nodes = [];
var emptyChar = "&#183";
var flashEmptyChar = ":";
var flashInterval = 20;
var cannotPlaceChar = "x";
var nodeChar = "=";
var cursorChar = "&#164";
var cursor;

/*
 ====================================================================================================
    STATES
 ====================================================================================================
*/

// State enums can be grouped as static members of a class
class STATE {
    // Create new instances of the same class as static attributes
    static SIMULATE = new STATE("SIMULATE");
    static PAUSED = new STATE("PAUSED");
    static PLACE = new STATE("PLACE");
    static INSPECT = new STATE("INSPECT");

    constructor(name) {
        this.name = name;
    }
}

/*
 ====================================================================================================
    LOOP
 ====================================================================================================
*/

async function RunLoop() {
    sim = new Simulation(50, 50, 50);
    ticks = 0;
    cursor = new Cursor();
    
    while (true) {
        if (sim.state != STATE.PAUSED) {
            UpdateSpinner();
            UpdateField();
            await new Promise(r => setTimeout(r, sim.updateInterval));
            ticks += 1;
        }
        else
            await new Promise(r => setTimeout(r, sim.updateInterval));
    }
}

class Simulation {
    constructor(width, height, updateInterval) {
        this.width = width;
        this.height = height;
        this.updateInterval = updateInterval;
        this.state = STATE.SIMULATE;
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

class Cursor {
    constructor() {
        this.x = 0;
        this.y = 0;
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
    if (sim.state == STATE.PLACE) {
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
    else if (sim.state == STATE.INSPECT) {
        tempGrid[cursor.y][cursor.x] = cursorChar;
    }
    
    let gridText = "";
    let char = "";
    for (row of tempGrid) {
        for (point of row) {
            char = point;
            // flash empty points
            if (sim.state == STATE.PLACE) {
                if (ticks % flashInterval < flashInterval / 2 && char == emptyChar)
                    char = flashEmptyChar;
            }
            // add to text
            gridText += char + "&nbsp";
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
    switch (sim.state) {
        case (STATE.SIMULATE):
            switch (event.keyCode) {
                case 80: // p
                    SetState(STATE.PAUSED);
                    break;
                case 73: // i
                    SetState(STATE.INSPECT);
                    GetInfo();
                    break;
            }
            break;
        case (STATE.PAUSED):
            switch (event.keyCode) {
                case 80: // p
                    SetState(STATE.SIMULATE);
                    break;
                case 73: // i
                    Debug("Error: must be in simulation state to enter inspect mode")
                    break;
            }
            break;
        case (STATE.PLACE):
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
                case 80: // p
                    Debug("Error: cannot pause while in place mode")
                    break;
                case 73: // i
                    Debug("Error: cannot inspect while in place mode")
                    break;
            }
            break;
        case (STATE.INSPECT):
            switch (event.keyCode) {
                case 65: // left
                    if (cursor.x > 0)
                        cursor.x -= 1;
                    GetInfo();
                    break;
                case 68: // right
                    if (cursor.x < sim.width - 1)
                        cursor.x += 1;
                    GetInfo();
                    break;
                case 87: // up
                    if (cursor.y > 0)
                        cursor.y -= 1;
                    GetInfo();
                    break;
                case 83: // down
                    if (cursor.y < sim.height - 1)
                        cursor.y += 1;
                    GetInfo();
                    break;
                case 13: // enter
                    NodeAction();
                    break;
                case 8: // del
                    DeleteNode();
                    GetInfo();
                    break;
                case 82: // r
                    Rename();
                    break;
                case 80: // p
                    Debug("Error: cannot pause while in inspect mode")
                    break;
                case 73: // i
                    SetState(STATE.SIMULATE);
                    ClearInfoText();
                    break;
            }
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
    SetState(STATE.SIMULATE);
    
    Debug("Node placed");
}

function CancelPlace() {
    // remove added node from nodes
    nodes.pop();
    // exit place mode
    SetState(STATE.SIMULATE);
    
    Debug("Action canceled");
}

// gets node that the cursor is hovering over
function GetNode() {
    // loop over all nodes to see what we're hovering over
    for (node of nodes) {
        // check x
        if (cursor.x >= node.x && cursor.x < node.x + node.width) {
            // check y
            if (cursor.y >= node.y && cursor.y < node.y + node.height) {
                // we are looking at this node
                return node;
            }
        }
    }
    return null;
}

function GetInfo() {
    let n = GetNode();
    let text = "";
    let info = document.getElementById("info");

    // cursor is not in a node
    if (n == null) {
        info.innerHTML = "";
        return;
    }

    for (i of n.info) {
        text += i + ": " + n[i] + "\n";
    }
    //text = node.type + ": " + node.name;
    info.innerHTML = text;
}

function ClearInfoText() {
    let info = document.getElementById("info");
    info.innerHTML = "";
}

function DeleteNode() {
    let n = GetNode();
    
    if (n == null) {
        Debug("Error no node to delete here");
        return;
    }
    
    for (let j = 0; j < n.height; j++) {                            // loop over node height
        let rowToChange = n.y + j;                                  // rows to change will be node pos.y + (0 to height-1)
        for (let i = 0; i < n.width; i++) {                         // loop over node width
            let columnToChange = n.x + i;                           // column to change will be node pos.x + (0 to width-1)
            sim.grid[rowToChange][columnToChange] = emptyChar;      // set that point to empty
        }
    }
    
    // get index of node and remove it from array
    let index = nodes.indexOf(n);
    if (index > -1)
        nodes.splice(index, 1);
    
    Debug("Node deleted");
}

function Rename() {
    let n = GetNode();
    
    if (n == null) {
        Debug("Error no node to rename here");
        return;
    }
    
    let newName = prompt("What will you rename this " + n.type + "?");
    if (newName == "")
        newName = n.type;
    n.SetName(newName);
    GetInfo(); // update info text
    
    // change grid
    let x = n.x + Math.floor(n.width / 2);
    let y = n.y + Math.floor(n.height / 2);
    sim.grid[y][x] = n.name.substr(0,1);
}

// pressing enter over a node will execute a function specific to that node
function NodeAction() {
    let n = GetNode();
    
    if (n == null) {
        Debug("Error no node to activate here");
        return;
    }
    
    n.Action();
    GetInfo();
}

function AddNode() {
    ClearInfoText();
    
    // cannot add a new node while already placing one
    if (sim.state == STATE.PLACE) {
        Debug("Error: cannot add new node while in place mode");
        return;
    }
    
    // get node from selection thing
    let nodeName = document.getElementById("nodeSelect").value;
    // create node
    var newNode;
    switch (nodeName) {
        case "INPUT":
            newNode = new Input();
            break;
        case "AND":
            newNode = new And();
            break;
        default:
            newNode = new Input();
            break;
    }
    
    // add to array
    nodes.push(newNode);
    SetState(STATE.PLACE);
    
    Debug("Placing new " + nodeName + " node");
}

/*
 ====================================================================================================
    NODES
 ====================================================================================================
*/

class Node {
    constructor(type, name, w, h) {
        this.type = type;
        this.x = 0;
        this.y = 0;
        this.width = w;
        this.height = h;
        this.shape = "";
        for (let j = 0; j < h; j++) {
            for (let i = 0; i < w; i++) {
                this.shape += nodeChar;
            }
        }
        this.info = [];
        this.SetName(name);
    }
    SetName(name) {
        let halfW = Math.floor(this.width / 2);
        let halfH = Math.floor(this.height / 2);
        let index = this.width * halfH + halfW;
        this.shape = StringReplace(this.shape, index, name);
        this.name = name;
    }
    Action() { Debug("No action on this node"); }
}

class Input extends Node {
    constructor() {
        super("Input node", "I", 3, 3);
        this.out = 0;
        this.info = ["type", "name", "out"];
    }
    Action() { // toggle value
        // flip from 0 to 1 and vice versa
        this.out = 1 - this.out;
        Debug("Output value changed");
    }
}

class And extends Node {
    constructor() {
        super("And gate", "A", 5, 5);
        this.in1 = "a";
        this.in2 = "b";
        this.out = "c";
        this.info = ["type", "name", "in1", "in2", "out"];
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

// replace nth index of string
function StringReplace(string, index, replacement) {
    return string.substr(0, index) + replacement + string.substr(index + replacement.length);
}

function SetState(state) {
    sim.state = state;
    
    let s = document.getElementById("state");
    s.innerHTML = state.name;
}
