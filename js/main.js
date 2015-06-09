(function(console){

  // ------- Helper functions --------
  var addEvent = function (el, event, func) {
    if (el.attachEvent) { return el.attachEvent('on'+event, func); } 
    else { return el.addEventListener(event, func, false); }
  };
  function classReg( className ) { return new RegExp("(^|\\s+)" + className + "(\\s+|$)"); }
  var hasClass, addClass, removeClass;
  if ( 'classList' in document.documentElement ) {
    hasClass = function( el, c ) { return el.classList.contains( c ); };
    addClass = function( el, c ) { el.classList.add( c ); };
    removeClass = function( el, c ) { el.classList.remove( c ); };
  } else {
    hasClass = function( el, c ) { return classReg( c ).test( el.className ); };
    addClass = function( el, c ) { if ( !hasClass( el, c ) ) { el.className = el.className + ' ' + c; }};
    removeClass = function( el, c ) { el.className = el.className.replace( classReg( c ), ' ' ); };
  }

 /** 
    * @desc the FlickrGettr construktor
    * @param takes a flickr id.
  */
  var FlickrGettr = function(unqid) {
      'use strict';
      this.unqid = unqid;
      this.baseUrl = 'https://api.flickr.com/services/rest/';
  };
  FlickrGettr.prototype = {
    unqid: null,
    baseUrl: null,

    constructor: FlickrGettr,
    /** 
      * @desc Makes the JSONP call and returns the data
      * @param string url - the REST url
      * @return promise - the reult wrapped in a promise
    */
    _fetch: function(url) {    
      var promise = new Promise(function(resolve, reject) {
        var callbackName = 'jsonp_callback_' + Math.round(100000 * Math.random()),
            script = document.createElement('script'),
            timer = setTimeout(function () {
              reject('no response');
              cleanup();
            }, 5000),
            cleanup = function(){
              window[callbackName] = null;
              delete window[callbackName];
              document.body.removeChild(script);
            };

        window[callbackName] = function(data) {
          resolve(data);
          clearTimeout(timer);
          cleanup();
        };

        script.src = url + '&jsoncallback=' + callbackName; 
        document.body.appendChild(script);

      });
      return promise;
    },

    /** 
      * @desc Fetches the realname from ownerID
      * @param object item - the image object
      * @return promise - the reult wrapped in a promise
    */
    _person: function(item){
      var promise = new Promise(function(resolve, reject) {
        var url = this.baseUrl + '?method=flickr.people.getInfo&api_key='+ this.unqid +'&user_id='+ item.owner +'&format=json';
        this._fetch(url)
          .then(function(result){ resolve(result); })
          .catch(function(err) { reject(err); });
      }.bind(this));

      return promise;
    },

    /** 
      * @desc Getts the data from the REST
      * @param array data - an object containing searchstring, per_page and page
      * @return promise - the reult wraped in a promise
    */
    search: function(data) {
      var promise = new Promise(function(resolve, reject) {
        var _data = data || {},
            _options = {
              search: _data.search || '',
              per_page: _data.per_page || 15,
              page: _data.page || 1
            },
            url = this.baseUrl + '?method=flickr.photos.search&api_key='+ this.unqid +'&tags='+ _options.search +'&per_page='+ _options.per_page +'&page='+ _options.page +'&format=json';

        this._fetch(url)
          .then(function(result) { resolve(result); })
          .catch(function(err) { reject(err); });

      }.bind(this));

      return promise;
    },

    /** 
      * @desc Gets the names from ownerIDs and appends them to the result object
      * @param object response - the reponse object
      * @return promise - the new reult wraped in a promise
    */
    getPersons: function( response ){
      var promise = new Promise(function(resolve, reject){
        Promise
          .all( response.photos.photo.map(this._person, this) )
          .then(function(person){ 
            person.forEach(function(obj, index){
              var name = obj.person.realname || '';
              response.photos.photo[index].realname = name;
            });
            resolve(response);
          })
          .catch(function(err){ reject(err); });
      }.bind(this));
      return promise;
    }
  };

 /** 
    * @desc the ImageGrid construktor
    * @param takes the flickr result 
  */
  var ImageGrid = function(flickrObj) {
      'use strict';
      this.flickrObj = flickrObj;
  };
  ImageGrid.prototype = {
    flickrObj: null,

    constructor: ImageGrid,

   /** 
      * @desc Generates a image url based
      * @param string farmID, string serverID, string id, string secret, string size
      * @return string - the image url
    */
    _generateURL: function (farmID, serverID, id, secret, size){
      return "http://farm" + farmID + ".static.flickr.com/" + serverID + "/" + id + "_" + secret + "_"+ size +".jpg";
    },

     /** 
      * @desc Generates a image for the imagegrid
      * @param object obj - the image object
      * @return promise - the new image wraped in a promise
    */
    _createThumbImage: function(obj){
      var promise = new Promise(function(resolve){
        var d = document.createElement('div'),
            i = new Image();

        i.src = this._generateURL(obj.farm, obj.server, obj.id, obj.secret, 't');
        i.alt = obj.title;
        i.title = obj.title;
        addClass(d, 'grid_item');
        d.appendChild(i);
        resolve(d);

      }.bind(this));

      return promise;
    },

    /** 
      * @desc Generates a image for the carousel
      * @param object obj - the image object
      * @return promise - the new image wraped in a promise
    */
    _createCarouselImage: function(obj){
      var promise = new Promise(function(resolve){
        var f = document.createElement('figure'),
            c = document.createElement('figcaption'),
            i = new Image();

        i.src = this._generateURL(obj.farm, obj.server, obj.id, obj.secret, 'c');
        i.alt = obj.title;
        i.title = obj.title;
        c.innerHTML = 'Photographer credit. ' + obj.realname._content; 
        f.appendChild(i);
        f.appendChild(c);
        resolve(f);
        
      }.bind(this));
      return promise;
    },

    /** 
      * @desc general image generator
      * @param object data - object containing classname, id and image generator function
      * @return promise - a collection of images wraped in a promise
    */
    _bindImage: function(data){
      var promise = new Promise(function(resolve, reject){
        var _data = data || {},
            _options = {
              className: _data.className || '',
              id: _data.id || '',
              generator: _data.generator || ''
            },
            el = document.getElementById(_options.id) || document.createElement('div'),
          photoArray = this.flickrObj.photo;

        while (el.firstChild) { 
          el.removeChild(el.firstChild); 
        }
        addClass(el, _options.className);
        el.id = _options.id;
        
        Promise.all( photoArray.map(_options.generator, this) )
          .then(function(images){ 
            images.forEach(function(img){
              el.appendChild(img);
            });
          })
          .catch(function(error) { reject(error); });

        resolve(el);

      }.bind(this));
      return promise;     
    },

    /** 
      * @desc Paginations builder
      * @return promise - pagination wraped in a promise
    */
    _bindPagination: function(){
      var promise = new Promise(function(resolve){
        var pager = document.getElementById('pagination') || document.createElement('div'),
            flickrObj = this.flickrObj,
            nodes = [
              {'goto': 1, 'text': '&lt;&lt;'},
              {'goto': Math.max(flickrObj.page - 1 , 1), 'text': '&lt;'},
              {'goto': Math.min(flickrObj.page + 1, flickrObj.pages), 'text': '&gt;'},
              {'goto': flickrObj.pages, 'text': '&gt;&gt;'}
            ],
            index = 2,
            isCurrentPage = false,
            startInt = Math.max(flickrObj.page -2 , 1),
            endInt = Math.min( startInt + 5, flickrObj.pages);
        
        for(var i = startInt; i < endInt; i++){
          isCurrentPage = (i === flickrObj.page)? true : false;
          nodes.splice(index++, 0, {'goto': i, 'text': i, 'active': isCurrentPage });
        }

        while (pager.firstChild) {
          pager.removeChild(pager.firstChild);
        }

        nodes.forEach(function(item){
          var span = document.createElement('span');
          span.innerHTML = item.text;
          if(item.active){
            addClass(span, 'active');
          } else {
            addEvent(span, 'click', function(){ 
              doSearch({searchValue: window.searchValue, page: item.goto}); 
            });
          }
          pager.appendChild(span);
        });
        pager.id = 'pagination';
        resolve(pager);

      }.bind(this));
      return promise;
    },

    /** 
      * @desc builds the carouesl
    */
    _setupCarousell: function(){
      var carousel = document.getElementById('carousel'),
          container = document.getElementById('container'),
          figures = container.getElementsByTagName('figure'),
          image_grid = document.getElementById('image_grid'),
          images = image_grid.getElementsByTagName('div'),
          currentSlide = 0,
          lastSlide = container.childNodes.length,
          slideControlls = document.createElement('div'),
          left = document.createElement('div'),
          arrow = document.createElement('div');

      function setMargin(){
        container.style.marginLeft = -(currentSlide * carousel.offsetWidth) + 'px';
      }
      function gotoNextSlide(){
        if(++currentSlide <= lastSlide - 1){ setMargin(); } 
        else { 
          currentSlide = 0;
          setMargin();
        }
      }
      function gotoPrevSlide(){
        if(--currentSlide >= 0){ setMargin(); } 
        else { 
          currentSlide = lastSlide -1; 
          setMargin(); 
        }
      }
      function gotoSlide(e){
        var target = (e.currentTarget) ? e.currentTarget : e.srcElement;
        var index = target.getAttribute('gotoSlide') || target.parentNode.getAttribute('gotoSlide');
        container.style.marginLeft = -(index * carousel.offsetWidth) + 'px'; 
        currentSlide = index;
      }

      arrow.className = 'arrow';

      left.className = 'controll left';
      left.appendChild(arrow);
      addEvent(left, 'click', gotoPrevSlide );
            
      var right = left.cloneNode(true);
      right.className = 'controll right';
      addEvent(right, 'click', gotoNextSlide );

      slideControlls.id = 'controlls';
      slideControlls.appendChild(left);
      slideControlls.appendChild(right);

      carousel.appendChild(slideControlls);

      container.style.width = (carousel.offsetWidth * lastSlide) + 'px';

      for( var index in figures ){
        if( index <= figures.length){
          var figure = figures[index];
          figure.style.width = carousel.offsetWidth + 'px';
        }
      }

      for( var image_index in images ){
        if( image_index <= images.length){
          var image = images[image_index];
          image.setAttribute('gotoSlide', image_index);
          addEvent(image, 'click', gotoSlide );
        }
      }
      setMargin();
    },

    /** 
      * @desc initiates the build prosses 
      * @param object data - object containing carousel element, content element and loader element
    */
    make: function(data){
      var _data = data || {},
          _options = {
            carouselEl: _data.carouselEl || document.getElementById('carousel'),
            contentEl: _data.contentEl || document.getElementById('content'),
            loaderEl: _data.loaderEl || document.getElementById('loader')
          },
          self = this;

      Promise.all([
        self._bindImage({'className': 'container', 'id': 'container', 'generator': self._createCarouselImage}),
        self._bindImage({'className': 'clearfix', 'id': 'image_grid', 'generator': self._createThumbImage}),
        self._bindPagination()
      ])
      .then(function(elems){
        _options.carouselEl.appendChild(elems[0]);
        _options.contentEl.appendChild(elems[1]);
        _options.contentEl.appendChild(elems[2]);
      })
      .then(function(){
        self._setupCarousell();
        addClass(_options.loaderEl, 'hidden');
      })
      .catch(function(error){ console.log('Error', error); });
    }
  };

  /** 
    * @desc initiates the serch prosses and then starts the building
    * @param object data - object containing searchValue, per_page, page and loder element
  */
  var doSearch = function (data){
    var flickr = new FlickrGettr("d654cb9bf3364181d856c7a7e45b3d2c"),
        _data = data || {},
        _options = {
          searchValue: _data.searchValue || 'consert',
          per_page: _data.per_page || 15,
          page: _data.page || 1,
          loaderEl: _data.loaderEl || document.getElementById('loader')
        };

    flickr.search({search: _options.searchValue, per_page: _options.per_page, page: _options.page,})
    .then(function( response ){ 
        return flickr.getPersons( response ); 
    })
    .then(function(response) {
        var gridMaker = new ImageGrid(response.photos);
        gridMaker.make();
    });
  };

  addEvent(document, 'load', doSearch() );

  var form = document.getElementById('search_box');
  addEvent(form, 'submit', function(e){
    if (e.preventDefault) { e.preventDefault(); } 
    else { e.returnValue = false; }

    window.searchValue = form.search.value || 'concert';   
    doSearch({searchValue: window.searchValue});
  }); 

})(window.console);