var mo = false;

function changeBackground(color) {
document.body.style.background = color;
}

window.addEventListener("load",function() { changeBackground('Black') });

// works out the X, Y position of the click inside the canvas from the X, Y position on the page
function getPosition(mouseEvent, sigCanvas) {
    var x, y;
    if (mouseEvent.pageX != undefined && mouseEvent.pageY != undefined) {
    x = mouseEvent.pageX;
    y = mouseEvent.pageY;
    } else {
    x = mouseEvent.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
    y = mouseEvent.clientY + document.body.scrollTop + document.documentElement.scrollTop;
    }

    return { X: x - sigCanvas.offsetLeft, Y: y - sigCanvas.offsetTop };
}

function initialize() {
    // get references to the canvas element as well as the 2D drawing context
    var sigCanvas = document.getElementById("canvasSignature");
    var context = sigCanvas.getContext("2d");
    context.strokeStyle = 'White';
    //var w = window.innerWidth;
    //var h = window.innerHeight;
    //context.canvas.width = window.innerWidth;
    //context.canvas.height = window.innerHeight;
    window.addEventListener('resize', resizeCanvas, false);
    resizeCanvas(sigCanvas);


    // start drawing when the mousedown event fires, and attach handlers to
    // draw a line to wherever the mouse moves to
    $("#canvasSignature").ready(function (mouseEvent) {
        var position = getPosition(mouseEvent, sigCanvas);

        //context.rect(position.X, position.Y, position.X+40, position.Y+20);
        //context.moveTo(position.X, position.Y);
        //context.beginPath();

        // attach event handlers
        $(this).mousemove(function (mouseEvent) {
            
            if(mo == true)
            {    
                mo = false;
                //rect(position.X, position.Y, position.X+40, position.Y+20);
                //fill();
                //changeBackground('Black');  
                
                //context.beginPath(getPosition(mouseEvent, sigCanvas));
            }
            else
            {
                //drawLine(mouseEvent, sigCanvas, context);
                
                //drawBackg(context2);
                drawRect(mouseEvent, sigCanvas, context);
                
                //context.moveTo(position.X, position.Y);
                
            }
        }).mouseout(function (mouseEvent) {
            mo = true;

                drawBackg(context);

            //stroke(mouseEvent, sigCanvas, context);
            //finishDrawing(mouseEvent, sigCanvas, context);
            //context.closePath();
            //context.moveTo(position.X, position.Y);
            //changeBackground('White');
            //context.closePath();
        });
    });


}

function drawBackg(context) {
    context.rect(0, 0, window.innerWidth, window.innerHeight);
    var grad = context.createLinearGradient(0, window.innerHeight, 0, 0)
    grad.addColorStop(0.01, 'Red');
    grad.addColorStop(0.15, 'Orange');
    grad.addColorStop(0.3, 'yellow');
    grad.addColorStop(0.45, 'Green');
    grad.addColorStop(0.6, 'Blue');
    grad.addColorStop(0.75, 'Indigo');
    grad.addColorStop(0.9, 'Violet');
    //grad.addColorStop(.005, 'gray');
    //grad.addColorStop(.9, 'green');
    context.fillStyle = grad;
    context.fill();
}

function drawRect(mouseEvent, sigCanvas, context) {
    var position = getPosition(mouseEvent, sigCanvas); 
    if(mo == true)
    {
    mo = false;
    rec.stroke();
    }
    else
    {
    drawBackg(context);

    context.rect(position.X - 50, position.Y - 50, 100 , 100);
    var grad = context.createRadialGradient(position.X, position.Y, 0, position.X, position.Y, 50)
    //grad.addColorStop(0.1, 'darkgrey');
    //grad.addColorStop(1, 'black');
    grad.addColorStop(0, 'Red');
    grad.addColorStop(0.15, 'Orange');
    grad.addColorStop(0.3, 'yellow');
    grad.addColorStop(0.45, 'Green');
    grad.addColorStop(0.6, 'Blue');
    grad.addColorStop(0.75, 'Indigo');
    grad.addColorStop(0.9, 'Violet');
    grad.addColorStop(0.91, 'Transparent');
    context.fillStyle = grad;
    context.fill();
    //context.fill();
    //context.lineTo(position.X, position.Y);
    //context.stroke();
    }
}

// draws a line to the x and y coordinates of the mouse event inside
// the specified element using the specified context
function drawLine(mouseEvent, sigCanvas, context) {
    var position = getPosition(mouseEvent, sigCanvas); 
    if(mo == true)
    {
    mo = false;
    context.stroke();
    }
    else
    {

    context.lineTo(position.X, position.Y);
    //context.arcTo(position.X, position.Y);
    context.stroke();
    }
}

// draws a line from the last coordiantes in the path to the finishing
// coordinates and unbind any event handlers which need to be preceded
// by the mouse down event
function finishDrawing(mouseEvent, sigCanvas, context) {
    // draw the line to the finishing coordinates
    drawLine(mouseEvent, sigCanvas, context);

    context.closePath();

    // unbind any events which could draw
    $(sigCanvas).unbind("mousemove")
                .unbind("mouseup")
                .unbind("mouseout");
}

function resizeCanvas(canvas) {
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
}
