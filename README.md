#FlickrGettr
a Flickr JavaScript promises test

The module is centred around two classes; 
* 'FlickrGettr', that handles all calls to the flickr rest service and returns the response array. 
* 'ImageGrid', that takes the response and builds the image grid and binds the clickhandler.

The main jsfunction is 'doSearch' that takes an object containing the search string and/or paging data. It uses javascript promises to time the calls between the REST api and the building progress.

The module uses three external extensions
* mormalize.css that makes all element behave more consistently
* modernizer.js that detects browser features 
* ES6-Promise a js promise polyfill for older browsers. 